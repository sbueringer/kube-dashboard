
export class RBAC{
    subjects: Subject[];
    roles: Role[];
    bindings: Binding[];
}

export class SubjectGroup{
    name: string;
    subjects: Subject[];
}

export class Subject{
    id: string;
    name: string;
    kind: string;
    namespace: string;
    apiGroup: string;
}

export class Role{
    id: string;
    name: string;
    namespace: string;
    kind: string;
    rules: Rule[];
}

export class Rule{
    apiGroups: string[];
    resources: string[];
    verbs: string[];
}

export class Right {
    resource: string;
    verbs: string[];
}

export class RightGroup {
    scope: string;
    rights: String[];
}

export class Binding{
    id: string;
    name: string;
    kind: string;
    namespace: string;
    roleRef: string;
    subjects: string[];
}
