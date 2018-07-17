
# Update Angular Go Package

````
./build.sh
````


# RBAC Data Model

https://kubernetes.io/docs/reference/access-authn-authz/rbac/

# Subjects:

subjects:
- kind: User
  name: "alice@example.com"
  apiGroup: rbac.authorization.k8s.io
  
subjects:
- kind: Group
  name: "frontend-admins"
  apiGroup: rbac.authorization.k8s.io
  
subjects:
- kind: ServiceAccount
  name: default
  namespace: kube-system
  
+> 

````
{
  "subjects": [
    { # User | Group | ServiceAccount
      "id": "user:admin|group:admins|serviceaccount:default:tiller"
      "name": "admin|admins|default",
      "kind": "User|Group|ServiceAccount",
      "namespace": "||kube-system",
      "apiGroup": "rbac.authorization.k8s.io|rbac.authorization.k8s.io|"
    }
  ]
  "roles": [
    {
      "id": "clusterrole:admin|role:tiller"
      "name": "admin|tiller"
      "kind": "ClusterRole|Role"
      "rules": [{
      
        apiGroups: [],
        resources; [],
        verbs: []
      }]
    }
  ]
  "bindings": [
    {
      "id": "clusterrolebinding:admin|rolebinding:tiller"
      "name": "admin|tiller"
      "kind": "ClusterRoleBinding|RoleBinding"
      "roleRef": "clusterrole:admin|role:tiller"
      "subjects": [
        {
          "id": "user:admin|serviceaccount:default:tiller"
        }
      ]
    }
  }
}
````


# ClusterRole & ClusterRoleBinding

kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: read-secrets-global
subjects:
- kind: Group
  name: manager # Name is case sensitive
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
  
apiVersion: rbac.authorization.k8s.io/v1                                                                                                                                                                             
kind: ClusterRole                                                                                                                                                                                                    
metadata:                                                                                                                                                                                                            
  name: system:controller:attachdetach-controller                                                                                                                                                                    
  labels:                                                                                                                                                                                                            
    kubernetes.io/bootstrapping: rbac-defaults                                                                                                                                                                       
  
rules:
- apiGroups:
  - ""
  resources:
  - persistentvolumeclaims
  verbs:
  - list

# Role & RoleBinding

apiVersion: rbac.authorization.k8s.io/v1                                                                                                                                                                             
kind: Role                                                                                                                                                                                                    
metadata:                                                                                                                                                                                                            
  name: system:controller:attachdetach-controller                                                                                                                                                                    
  labels:                                                                                                                                                                                                            
    kubernetes.io/bootstrapping: rbac-defaults                                                                                                                                                                       
  
rules:
- apiGroups:
  - ""
  resources:
  - persistentvolumeclaims
  verbs:
  - list

kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: User
  name: jane # Name is case sensitive
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role #this must be Role or ClusterRole
  name: pod-reader # this must match the name of the Role or ClusterRole you wish to bind to
  apiGroup: rbac.authorization.k8s.io

