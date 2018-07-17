// Copyright © 2018 NAME HERE <EMAIL ADDRESS>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/rakyll/statik/fs"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"time"
	"net/http"
	"log"
	"encoding/json"

	_ "github.com/sbueringer/kube-dashboard/statik"
)

var kubeConfigFile string
var kubeContext string
var clientset *kubernetes.Clientset
var clusterRoleStore cache.Store
var roleStore cache.Store
var clusterRoleBindingStore cache.Store
var roleBindingStore cache.Store

var rootCmd = &cobra.Command{
	Use:   "kube-dashboard",
	Short: "",
	Long:  ``,
	Run:   startServer(),
}

type rbac struct {
	Subjects []subject `json:"subjects"`
	Roles    []role    `json:"roles"`
	Bindings []binding `json:"bindings"`
}
type subject struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	ApiGroup  string `json:"apiGroup"`
}

type rule struct {
	ApiGroups []string `json:"apiGroups"`
	Resources []string `json:"resources"`
	Verbs     []string `json:"verbs"`
}

type role struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Rules     []rule `json:"rules"`
}

type binding struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Kind      string   `json:"kind"`
	Namespace string   `json:"namespace"`
	RoleRef   string   `json:"roleRef"`
	Subjects  []string `json:"subjects"`
}

func startServer() func(cmd *cobra.Command, args []string) {
	return func(cmd *cobra.Command, args []string) {
		createAndRunInformers()

		mux := http.NewServeMux()
		mux.Handle("/api", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			rbac := &rbac{}

			addedSubjects := make(map[string]bool)

			for _, entry := range clusterRoleBindingStore.List() {
				if crb, ok := entry.(*v1.ClusterRoleBinding); ok {
					var crbSubjects []string
					for _, sub := range crb.Subjects {
						id := sub.Kind + ":" + sub.Namespace + ":" + sub.Name
						if !addedSubjects[id] {
							rbac.Subjects = append(rbac.Subjects, subject{id, sub.Name, sub.Kind, sub.Namespace, sub.APIGroup})
							crbSubjects = append(crbSubjects, id)
							addedSubjects[id] = true
						}
					}
					id := "ClusterRoleBinding" + ":" + crb.Namespace + ":" + crb.Name
					roleRefID := crb.RoleRef.Kind + ":" + crb.Namespace + ":" + crb.RoleRef.Name
					rbac.Bindings = append(rbac.Bindings, binding{id, crb.Name, "ClusterRoleBinding", crb.Namespace, roleRefID, crbSubjects})
				}
			}
			for _, entry := range roleBindingStore.List() {
				if rb, ok := entry.(*v1.RoleBinding); ok {
					var rbSubjects []string
					for _, sub := range rb.Subjects {
						id := sub.Kind + ":" + sub.Namespace + ":" + sub.Name
						if !addedSubjects[id] {
							rbac.Subjects = append(rbac.Subjects, subject{id, sub.Name, sub.Kind, sub.Namespace, sub.APIGroup})
							rbSubjects = append(rbSubjects, id)
							addedSubjects[id] = true
						}
					}
					id := "RoleBinding" + ":" + rb.Namespace + ":" + rb.Name
					roleRefID := rb.RoleRef.Kind + ":" + rb.Namespace + ":" + rb.RoleRef.Name
					rbac.Bindings = append(rbac.Bindings, binding{id, rb.Name, "RoleBinding", rb.Namespace, roleRefID, rbSubjects})
				}
			}

			for _, entry := range clusterRoleStore.List() {
				if cr, ok := entry.(*v1.ClusterRole); ok {
					id := "ClusterRole" + ":" + cr.Namespace + ":" + cr.Name
					role := role{id, cr.Name, "ClusterRole", cr.Namespace, []rule{}}
					for _, r := range cr.Rules {
						role.Rules = append(role.Rules, rule{r.APIGroups, r.Resources, r.Verbs})
					}
					rbac.Roles = append(rbac.Roles, role)
				}
			}
			for _, entry := range roleStore.List() {
				if r, ok := entry.(*v1.Role); ok {
					id := "Role" + ":" + r.Namespace + ":" + r.Name
					role := role{id, r.Name, "Role", r.Namespace, []rule{}}
					for _, r := range r.Rules {
						role.Rules = append(role.Rules, rule{r.APIGroups, r.Resources, r.Verbs})
					}
					rbac.Roles = append(rbac.Roles, role)
				}
			}

			body, err := json.Marshal(rbac)
			if err != nil {
				panic(err)
			}
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Write(body)
			//fmt.Fprintf(w, "%v", clusterRoleStore.List())
		}))
		// current Angular build folder
		//files := http.FileServer(http.Dir("/home/fedora/code/gopath/src/github.com/sbueringer/kube-dashboard/dist/kube-dashboard"))
		// statik folder
		statikFs, err := fs.New()
		files := http.FileServer(statikFs)

		if err != nil { panic(err) }
		mux.Handle("/", files)

		log.Print("Listening on :8080")
		if err := http.ListenAndServe(":8080", mux); err != nil {
			log.Fatalf("http.ListenAndServe failed %v", err)
		}
	}
}

func createAndRunInformers() {
	createAndRunInformer(&clusterRoleStore,
		func(lo metav1.ListOptions) (runtime.Object, error) {
			return clientset.RbacV1().ClusterRoles().List(lo)
		}, func(lo metav1.ListOptions) (watch.Interface, error) {
			lo.Watch = true
			return clientset.RbacV1().ClusterRoles().Watch(lo)
		}, &v1.ClusterRole{})

	createAndRunInformer(&clusterRoleBindingStore,
		func(lo metav1.ListOptions) (runtime.Object, error) {
			return clientset.RbacV1().ClusterRoleBindings().List(lo)
		}, func(lo metav1.ListOptions) (watch.Interface, error) {
			lo.Watch = true
			return clientset.RbacV1().ClusterRoleBindings().Watch(lo)
		}, &v1.ClusterRoleBinding{})

	createAndRunInformer(&roleStore,
		func(lo metav1.ListOptions) (runtime.Object, error) {
			return clientset.RbacV1().Roles("").List(lo)
		}, func(lo metav1.ListOptions) (watch.Interface, error) {
			lo.Watch = true
			return clientset.RbacV1().Roles("").Watch(lo)
		}, &v1.Role{})

	createAndRunInformer(&roleBindingStore,
		func(lo metav1.ListOptions) (runtime.Object, error) {
			return clientset.RbacV1().RoleBindings("").List(lo)
		}, func(lo metav1.ListOptions) (watch.Interface, error) {
			lo.Watch = true
			return clientset.RbacV1().RoleBindings("").Watch(lo)
		}, &v1.RoleBinding{})
}

func createAndRunInformer(globalStore *cache.Store, listFunc func(lo metav1.ListOptions) (runtime.Object, error), watchFunc func(lo metav1.ListOptions) (watch.Interface, error), objType runtime.Object) {
	store, controller := cache.NewInformer(
		&cache.ListWatch{
			ListFunc:  listFunc,
			WatchFunc: watchFunc,
		},
		objType,
		300*time.Second,
		cache.ResourceEventHandlerFuncs{},
			//AddFunc: func(obj interface{}) {
			//	log.Printf("%v\n", obj)
			//}},
	)
	*globalStore = store
	go controller.Run(wait.NeverStop)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initKubeCfg)

	rootCmd.PersistentFlags().StringVarP(&kubeConfigFile, "kubeconfig", "k", fmt.Sprintf("%s%s.kube%sconfig_minikube", os.Getenv("HOME"), string(os.PathSeparator), string(os.PathSeparator)), "Path to the kubeconfig file to use for CLI requests")
	rootCmd.PersistentFlags().StringVarP(&kubeContext, "context", "c", "", "Kube context to use for CLI requests")
}

func initKubeCfg() {
	var config *rest.Config
	var err error

	if kubeContext != ""{
		config, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
			&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeConfigFile},
			&clientcmd.ConfigOverrides{CurrentContext: kubeContext}).ClientConfig()
	} else {
		config, err = clientcmd.BuildConfigFromFlags("", kubeConfigFile)
		if err != nil {
			panic(err.Error())
		}
	}
	clientset = kubernetes.NewForConfigOrDie(config)
}
