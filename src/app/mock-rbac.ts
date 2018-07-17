// import { Role } from './rbac';

import {RBAC} from "./rbac";

export const rbacMock: RBAC = {
    subjects: [{
        id: "user:admin",
        name: "admin",
        kind: "User",
        namespace: "",
        apiGroup: "rbac.authorization.k8s.io"
    },
        {
            id: "user:user",
            name: "user",
            kind: "User",
            namespace: "",
            apiGroup: "rbac.authorization.k8s.io"
        },
        {
            id: "group:admins",
            name: "admins",
            kind: "Group",
            namespace: "",
            apiGroup: "rbac.authorization.k8s.io"
        },
        {
            id: "serviceaccount:default:default",
            name: "default",
            kind: "ServiceAccount",
            namespace: "default",
            apiGroup: ""
        }
    ],
    roles: [{
        id: "clusterrole:admin",
        name: "admin",
        kind: "ClusterRole",
        namespace: "",
        rules: [{
            apiGroups: [],
            resources: [],
            verbs: []
        }]
    },
        {
            id: "role:default:tiller",
            name: "tiller",
            kind: "Role",
            namespace: "default",
            rules: [{
                apiGroups: [],
                resources: [],
                verbs: []
            }]
        }],
    bindings: [{
        id: "clusterrolebinding:admin",
        name: "admin",
        kind: "ClusterRoleBinding",
        namespace: "",
        roleRef: "clusterrole:admin",
        subjects: [
            "user:admin"
        ]
    }]
};
