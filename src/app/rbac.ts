

export class RBAC{
    mappings: Mapping [];
    subjects: Map<String,Subject>;
    roleBindings: Map<String,RoleBinding>;
    roles: Map<String,Role>;
    rules: Map<String,Rule>;
}

export class Mapping{
    subjectID: string;
    roleBindingID: string;
    roleID: string;
    ruleID: string;
}

export class Subject{
    id: string;
    name: string;
    kind: string;
    namespace: string;
    apiGroup: string;
}

export class RoleBinding{
    id: string;
    name: string;
    kind: string;
    namespace: string;
    roleRef: string;
    subjects: string[];
}

export class Role{
    id: string;
    name: string;
    namespace: string;
    kind: string;
}

export class Rule{
    id: string;
    display: string;
    apiGroup: string;
    resource: string;
    resourceName: string;
    verbs: string[];
}

export class NamespacedRoleBindingRule{
    namespace: string;
    roleRules: RoleBindingRule[];
}

export class RoleBindingRule{
    roleBinding: RoleBinding;
    rule: Rule;
}