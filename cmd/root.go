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
	Mappings     []mapping              `json:"mappings"`
	Subjects     map[string]subject     `json:"subjects"`
	RoleBindings map[string]roleBinding `json:"roleBindings"`
	Roles        map[string]role        `json:"roles"`
	Rules        map[string]rule        `json:"rules"`
}

type mapping struct {
	SubjectID     string `json:"subjectID"`
	RoleBindingID string `json:"roleBindingID"`
	RoleID        string `json:"roleID"`
	RuleID        string `json:"ruleID"`
}

type subject struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	ApiGroup  string `json:"apiGroup"`
}

type roleBinding struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Kind      string   `json:"kind"`
	Namespace string   `json:"namespace"`
	RoleRef   string   `json:"roleRef"`
	Subjects  []string `json:"subjects"`
}

type role struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
}

type rule struct {
	ID           string   `json:"id"`
	ApiGroup     string   `json:"apiGroup"`
	Resource     string   `json:"resource"`
	ResourceName string   `json:"resourceName"`
	Verbs        []string `json:"verbs"`
}

var clusterWideIdentifier = "ClusterWide"

func startServer() func(cmd *cobra.Command, args []string) {
	return func(cmd *cobra.Command, args []string) {
		createAndRunInformers()

		mux := http.NewServeMux()

		mux.Handle("/api", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			rbac := &rbac{
				Roles:        make(map[string]role),
				Subjects:     make(map[string]subject),
				RoleBindings: make(map[string]roleBinding),
				Rules:        make(map[string]rule),
			}

			roleIDRuleIDs := make(map[string][]string)

			for _, entry := range clusterRoleStore.List() {
				if r, ok := entry.(*v1.ClusterRole); ok {
					roleID := calculateID(r)
					role := role{roleID, r.Name, "ClusterRole", clusterWideIdentifier}
					rbac.Roles[roleID] = role

					for _, ru := range r.Rules {
						for _, apiGroup := range ru.APIGroups {
							for _, resource := range ru.Resources { //TODO resourcenames
								if len(ru.ResourceNames) > 0 {
									for _, resourceName := range ru.ResourceNames {
										ruleID := fmt.Sprintf("%s|%s|%s|%s", apiGroup, resource, resourceName, ru.Verbs)
										rbac.Rules[ruleID] = rule{
											ID:           ruleID,
											ApiGroup:     apiGroup,
											Resource:     resource,
											ResourceName: resourceName,
											Verbs:        ru.Verbs,
										}
										ruleIDs := roleIDRuleIDs[roleID]
										if ruleIDs == nil {
											ruleIDs = []string{}
										}
										ruleIDs = append(ruleIDs, ruleID)
										roleIDRuleIDs[roleID] = ruleIDs
									}
								} else {
									ruleID := fmt.Sprintf("%s|%s|*|%s", apiGroup, resource, ru.Verbs)
									rbac.Rules[ruleID] = rule{
										ID:           ruleID,
										ApiGroup:     apiGroup,
										Resource:     resource,
										ResourceName: "",
										Verbs:        ru.Verbs,
									}
									ruleIDs := roleIDRuleIDs[roleID]
									if ruleIDs == nil {
										ruleIDs = []string{}
									}
									ruleIDs = append(ruleIDs, ruleID)
									roleIDRuleIDs[roleID] = ruleIDs
								}
							}
						}
					}

				}
			}
			for _, entry := range roleStore.List() {
				if r, ok := entry.(*v1.Role); ok {
					roleID := calculateID(r)
					role := role{roleID, r.Name, "Role", r.Namespace}
					rbac.Roles[roleID] = role

					for _, ru := range r.Rules {
						for _, apiGroup := range ru.APIGroups {
							for _, resource := range ru.Resources { //TODO resourcenames
								if len(ru.ResourceNames) > 0 {
									for _, resourceName := range ru.ResourceNames {
										ruleID := fmt.Sprintf("%s|%s|%s|%s", apiGroup, resource, resourceName, ru.Verbs)
										rbac.Rules[ruleID] = rule{
											ID:           ruleID,
											ApiGroup:     apiGroup,
											Resource:     resource,
											ResourceName: resourceName,
											Verbs:        ru.Verbs,
										}
										ruleIDs := roleIDRuleIDs[roleID]
										if ruleIDs == nil {
											ruleIDs = []string{}
										}
										ruleIDs = append(ruleIDs, ruleID)
										roleIDRuleIDs[roleID] = ruleIDs
									}
								} else {
									ruleID := fmt.Sprintf("%s|%s|*|%s", apiGroup, resource, ru.Verbs)
									rbac.Rules[ruleID] = rule{
										ID:           ruleID,
										ApiGroup:     apiGroup,
										Resource:     resource,
										ResourceName: "",
										Verbs:        ru.Verbs,
									}
									ruleIDs := roleIDRuleIDs[roleID]
									if ruleIDs == nil {
										ruleIDs = []string{}
									}
									ruleIDs = append(ruleIDs, ruleID)
									roleIDRuleIDs[roleID] = ruleIDs
								}
							}
						}
					}
				}
			}

			for _, entry := range clusterRoleBindingStore.List() {
				if crb, ok := entry.(*v1.ClusterRoleBinding); ok {
					crbID := calculateID(crb)
					roleID := calculateIDNamespace(&crb.RoleRef, clusterWideIdentifier)
					var subIds []string
					for _, sub := range crb.Subjects {
						subID := calculateID(&sub)
						subIds = append(subIds, subID)
						if _, ok := rbac.Subjects[subID]; !ok {
							ns := sub.Namespace
							if ns == "" {
								ns = clusterWideIdentifier
							}
							rbac.Subjects[subID] = subject{
								ID:        subID,
								Name:      sub.Name,
								Namespace: ns,
								Kind:      sub.Kind,
								ApiGroup:  sub.APIGroup,
							}
						}
						if ruleIDs, ok := roleIDRuleIDs[roleID]; ok {
							for _, ruleID := range ruleIDs {
								rbac.Mappings = append(rbac.Mappings, mapping{
									SubjectID:     subID,
									RoleBindingID: crbID,
									RoleID:        roleID,
									RuleID:        ruleID,
								})
							}
						}
					}
					rbac.RoleBindings[crbID] = roleBinding{
						ID:        crbID,
						Name:      crb.Name,
						Namespace: crb.Namespace,
						Kind:      "ClusterRoleBinding",
						RoleRef:   roleID,
						Subjects:  subIds,
					}
				}
			}
			for _, entry := range roleBindingStore.List() {
				if rb, ok := entry.(*v1.RoleBinding); ok {
					rbID := calculateID(rb)
					roleID := calculateIDNamespace(&rb.RoleRef, rb.Namespace)
					var subIds []string
					for _, sub := range rb.Subjects {
						subID := calculateID(&sub)
						subIds = append(subIds, subID)
						if _, ok := rbac.Subjects[subID]; !ok {
							ns := sub.Namespace
							if ns == "" {
								ns = clusterWideIdentifier
							}
							rbac.Subjects[subID] = subject{
								ID:        subID,
								Name:      sub.Name,
								Namespace: ns,
								Kind:      sub.Kind,
								ApiGroup:  sub.APIGroup,
							}
						}
						if ruleIDs, ok := roleIDRuleIDs[roleID]; ok {
							for _, ruleID := range ruleIDs {
								rbac.Mappings = append(rbac.Mappings, mapping{
									SubjectID:     subID,
									RoleBindingID: rbID,
									RoleID:        roleID,
									RuleID:        ruleID,
								})
							}
						}
					}
					rbac.RoleBindings[rbID] = roleBinding{
						ID:        rbID,
						Name:      rb.Name,
						Namespace: rb.Namespace,
						Kind:      "RoleBinding",
						RoleRef:   roleID,
						Subjects:  subIds,
					}
				}
			}

			body, err := json.Marshal(rbac)
			if err != nil {
				panic(err)
			}
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Write(body)
		}))

		// current Angular build folder
		//files := http.FileServer(http.Dir("/home/fedora/code/gopath/src/github.com/sbueringer/kube-dashboard/dist/kube-dashboard"))
		// statik folder
		statikFs, err := fs.New()
		files := http.FileServer(statikFs)

		if err != nil {
			panic(err)
		}
		mux.Handle("/", files)

		log.Print("Listening on :8080")
		if err := http.ListenAndServe(":8080", mux); err != nil {
			log.Fatalf("http.ListenAndServe failed %v", err)
		}
	}
}

func calculateID(entry interface{}) string {
	if r, ok := entry.(*v1.Role); ok {
		return "Role" + "|" + r.Namespace + "|" + r.Name
	}
	if cr, ok := entry.(*v1.ClusterRole); ok {
		return "ClusterRole" + "|" + clusterWideIdentifier + "|" + cr.Name
	}
	if rb, ok := entry.(*v1.RoleBinding); ok {
		return "RoleBinding" + "|" + rb.Namespace + "|" + rb.Name
	}
	if crb, ok := entry.(*v1.ClusterRoleBinding); ok {
		return "ClusterRoleBinding" + "|" + clusterWideIdentifier + "|" + crb.Name
	}
	if sub, ok := entry.(*v1.Subject); ok {
		if sub.Namespace == "" {
			return sub.Kind + "|" + clusterWideIdentifier + "|" + sub.Name
		}
		return sub.Kind + "|" + sub.Namespace + "|" + sub.Name
	}
	return "Unknown type: couldn't calculate ID"
}

func calculateIDNamespace(entry interface{}, ns string) string {
	if r, ok := entry.(*v1.RoleRef); ok {
		if ns == "" {
			return r.Kind + "|" + clusterWideIdentifier + "|" + r.Name
		}
		return r.Kind + "|" + ns + "|" + r.Name
	}
	return "Unknown type: couldn't calculate ID"
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

	if kubeContext != "" {
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
