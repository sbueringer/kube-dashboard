import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Binding, RBAC, RightGroup, Role, Subject} from "../rbac";
import {RbacService} from "../rbac.service";
import {FormControl} from "@angular/forms";
import {ReplaySubject} from "rxjs/index";
import {takeUntil} from "rxjs/internal/operators";

@Component({
    selector: 'app-rbac',
    templateUrl: './rbac.component.html',
    styleUrls: ['./rbac.component.css']
})
export class RbacComponent implements OnInit {
    private rbac: RBAC;

    private selectedSubjects: Subject[] = [];
    private selectedSubjectsIds: string[] = [];
    private selectSubjects: Map<string, Array<Subject>> = new Map();
    private subjectFilterCtrl: FormControl = new FormControl();

    filterSubjects(){
        if(!this.selectSubjects){
            return;
        }
        let search = this.subjectFilterCtrl.value;
        if (!search){
            this.filteredUsers.next(this.selectSubjects.get("User"));
            this.filteredGroups.next(this.selectSubjects.get("Group"));
            this.filteredServiceAccounts.next(this.selectSubjects.get("ServiceAccount"));
        } else {
            search = search.toLowerCase();
        }
        this.filteredUsers.next(this.selectSubjects.get("User").filter(subject => subject.name.toLowerCase().indexOf(search) > -1));
        this.filteredGroups.next(this.selectSubjects.get("Group").filter(subject => subject.name.toLowerCase().indexOf(search) > -1));
        this.filteredServiceAccounts.next(this.selectSubjects.get("ServiceAccount").filter(subject => subject.name.toLowerCase().indexOf(search) > -1));
    }
    private user: Subject[] = [];
    public filteredUsers: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);
    private groups: Subject[] = [];
    public filteredGroups: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);
    private serviceAccounts: Subject[] = [];
    public filteredServiceAccounts: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);

    private selectedScopes: string[] = [];
    private selectScopes: Map<string, Array<string>> = new Map();
    private namespaces: string[] = [];
    private clusterWide: string = null;

    private selectedRoles: Role[] = [];
    private selectRoles: Map<string, Array<Role>> = new Map();
    private roles: Role[] = [];
    private clusterRoles: Role[] = [];

    private bindings: Binding[] = [];
    private matchedBindings: Binding[] = [];

    private bindingsByRoleRef: Map<string, Array<Binding>> = new Map();
    private rolesByRoleRef: Map<string, Role> = new Map();

    private rights: RightGroup[] = [];

    constructor(
        private route: ActivatedRoute,
        private rbacService: RbacService
    ) {
        this.subjectFilterCtrl.valueChanges.subscribe(() => this.filterSubjects());
        this.rbacService.getRBAC().subscribe(newRBAC => {
            this.rbac = newRBAC;

            this.selectSubjects = new Map();
            this.selectSubjects.set("User", newRBAC.subjects.filter(sub => sub.kind == "User"));
            this.selectSubjects.set("Group", newRBAC.subjects.filter(sub => sub.kind == "Group"));
            this.selectSubjects.set("ServiceAccount", newRBAC.subjects.filter(sub => sub.kind == "ServiceAccount"));
            this.filteredUsers.next(this.selectSubjects.get("User"));
            this.filteredGroups.next(this.selectSubjects.get("Group"));
            this.filteredServiceAccounts.next(this.selectSubjects.get("ServiceAccount"));

            this.selectRoles = new Map();
            this.selectRoles.set("Role", newRBAC.roles.filter(role => role.kind == "Role"));
            this.selectRoles.set("ClusterRole", newRBAC.roles.filter(role => role.kind == "ClusterRole"));

            this.selectScopes = new Map();
            this.selectScopes.set("Namespace", Array.from(new Set(this.rbac.bindings
                .filter(roleBinding => roleBinding.kind == "RoleBinding")
                .map(roleBinding => roleBinding.namespace))));
            this.selectScopes.set("Cluster-wide", ["Cluster-wide"]);

            this.bindings = this.rbac.bindings;
            for (let b of this.bindings) {
                let tmpBindings = this.bindingsByRoleRef.get(b.roleRef);
                if (!tmpBindings) {
                    tmpBindings = [];
                }
                tmpBindings.push(b);
                this.bindingsByRoleRef.set(b.roleRef, tmpBindings);
            }
            for (let role of newRBAC.roles) {
                this.rolesByRoleRef.set(role.id, role);
            }
            this.calculateVisibleObjects();
        });
    }

    calculateVisibleObjects() {
        this.matchedBindings = [];
        if (this.selectedSubjects.length == 0 && this.selectedScopes.length == 0 && this.selectedRoles.length == 0) {
            this.user = this.selectSubjects.get("User");
            this.groups = this.selectSubjects.get("Group");
            this.serviceAccounts = this.selectSubjects.get("ServiceAccount");

            this.roles = this.selectRoles.get("Role");
            this.clusterRoles = this.selectRoles.get("ClusterRole");

            this.namespaces = Array.from(new Set(this.rbac.bindings
                .filter(roleBinding => roleBinding.kind == "RoleBinding")
                .map(roleBinding => roleBinding.namespace)));
            this.clusterWide = "Cluster-wide";

            this.matchedBindings = this.bindings
        } else {
            if (this.selectedSubjects.length > 0) {
                this.selectedSubjectsIds = this.selectedSubjects.map(s => s.id);

                this.user = this.selectedSubjects.filter(s => s.kind == "User");
                this.groups = this.selectedSubjects.filter(s => s.kind == "Group");
                this.serviceAccounts = this.selectedSubjects.filter(s => s.kind == "ServiceAccount");


                this.roles = this.selectRoles.get("Role")
                    .filter(role => {
                        let bindingsForRole = this.bindingsByRoleRef.get(role.id);
                        if (bindingsForRole) {
                            let match = false;
                            for (let b of bindingsForRole) {
                                if (b.subjects && this.intersection(b.subjects, this.selectedSubjectsIds).length > 0) {
                                    this.matchedBindings.push(b);
                                    console.log("Matched binding:" + bindingsForRole);
                                    match = true;
                                }
                            }
                            return match;
                        }
                        return false;
                    });
                this.clusterRoles = this.selectRoles.get("ClusterRole")
                    .filter(role => {
                        let bindingsForRole = this.bindingsByRoleRef.get(role.id);
                        if (bindingsForRole) {
                            let match = false;
                            for (let b of bindingsForRole) {
                                if (b.subjects && this.intersection(b.subjects, this.selectedSubjectsIds).length > 0) {
                                    this.matchedBindings.push(b);
                                    console.log("Matched binding:" + bindingsForRole);
                                    match = true;
                                }
                            }
                            return match;
                        }
                        return false;
                    });

                this.namespaces = Array.from(new Set(this.matchedBindings.filter(b => b.kind == "RoleBinding").map(b => b.namespace)));
                this.clusterWide = this.clusterRoles.length > 0 ? "Cluster-wide" : "";
            }
        }

        // calculate rights
        this.rights = [];
        let rightsMap: Map<string, Array<string>> = new Map();

        for (let binding of this.matchedBindings) {
            let role = this.rolesByRoleRef.get(binding.roleRef);
            for (let rule of role.rules) {
                if (rule.resources) {
                    for (let res of rule.resources) {

                        let namespace: string;
                        if (binding.kind == "RoleBinding") { // RoleBindings bind per namespace (doesn't matter if Role or ClusterRole)
                            namespace = binding.namespace
                        } else { // ClusterRoleBindings bind cluster-wide
                            namespace = "Cluster-wide"
                        }
                        let rightsByNamespace = rightsMap.get(namespace);
                        if (!rightsByNamespace) {
                            rightsByNamespace = []
                        }
                        rightsByNamespace.push(res + ": " + rule.verbs); //TODO rights may be not unique (i.e. redundant) per namespace
                        rightsMap.set(namespace, rightsByNamespace);
                    }
                }
            }
        }
        rightsMap.forEach((rights: string[], scope: string) => {
            let uniqueRights = Array.from(new Set(rights));
            this.rights.push({scope: scope, rights: uniqueRights});
        })

        // Subject => Role/ClusterRoleBinding => Role/ClusterRole
        // Subject filtered => filters roles and scopes of this roles

        // Scope => Subjects with Scope => Role/ClusterRole in this scope

        // Role/ClusterRole => Role/ClusterRoleBinding => Subjects


    }

    intersection(array1: string[], array2: string[]): string[] {
        return array1.filter(value => -1 !== array2.indexOf(value));
    }

    ngOnInit(): void {

    }

}


/*
Copyright 2017-2018 Google Inc. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at http://angular.io/license
*/