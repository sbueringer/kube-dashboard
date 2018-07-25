import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Mapping, NamespacedRoleBindingRule, RBAC, Role, RoleBinding, RoleBindingRule, Subject} from '../rbac';
import {KubeService} from '../kube.service';
import {FormControl} from '@angular/forms';
import {ReplaySubject} from 'rxjs/index';
import {b} from '@angular/core/src/render3';

@Component({
    selector: 'app-rbac',
    templateUrl: './rbac.component.html',
    styleUrls: ['./rbac.component.css']
})
export class RbacComponent implements OnInit {
    private rbac: RBAC;


    // Subjects
    private selectedSubjects: Subject[] = [];

    private selectSubjects: Map<string, Array<Subject>> = new Map();
    private subjectFilterCtrl: FormControl = new FormControl();

    public selectFilteredUsers: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);
    public selectFilteredGroups: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);
    public selectFilteredServiceAccounts: ReplaySubject<Subject[]> = new ReplaySubject<Subject[]>(1);

    private visibleUsers: Subject[] = [];
    private visibleGroups: Subject[] = [];
    private visibleServiceAccounts: Subject[] = [];


    // RoleBindings
    private selectedRoleBindings: RoleBinding[] = [];

    private selectRoleBindings: Map<string, Array<RoleBinding>> = new Map();
    private roleBindingFilterCtrl: FormControl = new FormControl();

    public selectFilteredRoleBindings: ReplaySubject<RoleBinding[]> = new ReplaySubject<RoleBinding[]>(1);
    public selectFilteredClusterRoleBindings: ReplaySubject<RoleBinding[]> = new ReplaySubject<RoleBinding[]>(1);

    private visibleRoleBindings: RoleBinding[] = [];
    private visibleClusterRoleBindings: RoleBinding[] = [];


    // Roles
    private selectedRoles: Role[] = [];

    private selectRoles: Map<string, Array<Role>> = new Map();
    private roleFilterCtrl: FormControl = new FormControl();

    public selectFilteredRoles: ReplaySubject<Role[]> = new ReplaySubject<Role[]>(1);
    public selectFilteredClusterRoles: ReplaySubject<Role[]> = new ReplaySubject<Role[]>(1);

    private visibleRoles: Role[] = [];
    private visibleClusterRoles: Role[] = [];


    // Rules
    private selectedRoleBindingRule: RoleBindingRule[] = [];

    private selectNamespacedRoleBindingRules: NamespacedRoleBindingRule[] = [];
    private roleBindingRuleFilterCtrl: FormControl = new FormControl();

    public selectFilteredNamespacesRoleBindingRules: ReplaySubject<NamespacedRoleBindingRule[]> = new ReplaySubject<NamespacedRoleBindingRule[]>(1);

    private visibleNamespacedRoleBindingRules: NamespacedRoleBindingRule[] = [];


    constructor(
        private route: ActivatedRoute,
        private kubeService: KubeService
    ) {

        this.subjectFilterCtrl.valueChanges.subscribe(() => this.filterSubjects());
        this.roleFilterCtrl.valueChanges.subscribe(() => this.filterRoles());
        this.roleBindingFilterCtrl.valueChanges.subscribe(() => this.filterRoleBindings());
        this.roleBindingRuleFilterCtrl.valueChanges.subscribe(() => this.filterRules());


        this.refreshRBAC();

        this.kubeService.commandSent$.subscribe( cmd => {
            if (cmd == "refreshRBAC"){
                this.refreshRBAC();
            }
        })
    }

    private refreshRBAC() {
        this.kubeService.getRBAC().subscribe(newRBAC => {
            this.rbac = newRBAC;

            this.handleRBACUpdate();

            this.selectedSubjects = [];
            this.selectedRoleBindings = [];
            this.selectedRoles = [];
            this.selectedRoleBindingRule = [];
            this.calculateVisibleObjects();
        });
    }

    private handleRBACUpdate() {

        let newSubjectArray = Object.values(this.rbac.subjects);
        this.selectSubjects = new Map();
        this.selectSubjects.set('User', newSubjectArray.filter(sub => sub.kind == 'User'));
        this.selectSubjects.set('Group', newSubjectArray.filter(sub => sub.kind == 'Group'));
        this.selectSubjects.set('ServiceAccount', newSubjectArray.filter(sub => sub.kind == 'ServiceAccount'));

        this.selectFilteredUsers.next(this.selectSubjects.get('User'));
        this.selectFilteredGroups.next(this.selectSubjects.get('Group'));
        this.selectFilteredServiceAccounts.next(this.selectSubjects.get('ServiceAccount'));


        let newRoleBindingsArray = Object.values(this.rbac.roleBindings);
        this.selectRoleBindings = new Map();
        this.selectRoleBindings.set('RoleBinding', newRoleBindingsArray.filter(roleBinding => roleBinding.kind == 'RoleBinding'));
        this.selectRoleBindings.set('ClusterRoleBinding', newRoleBindingsArray.filter(roleBinding => roleBinding.kind == 'ClusterRoleBinding'));

        this.selectFilteredRoleBindings.next(this.selectRoleBindings.get('RoleBinding'));
        this.selectFilteredClusterRoleBindings.next(this.selectRoleBindings.get('ClusterRoleBinding'));


        let newRolesArray = Object.values(this.rbac.roles);
        this.selectRoles = new Map();
        this.selectRoles.set('Role', newRolesArray.filter(role => role.kind == 'Role'));
        this.selectRoles.set('ClusterRole', newRolesArray.filter(role => role.kind == 'ClusterRole'));

        this.selectFilteredRoles.next(this.selectRoles.get('Role'));
        this.selectFilteredClusterRoles.next(this.selectRoles.get('ClusterRole'));


        // build Map so that NamespacedRoleBindingRules can be build
        let roleBindingRulesMap = this.convertMappingsToRoleBindingRules(this.rbac.mappings);
        this.selectNamespacedRoleBindingRules = [];
        roleBindingRulesMap.forEach((roleBindingRules: RoleBindingRule[], namespace: string) => {
            this.selectNamespacedRoleBindingRules.push({namespace: namespace, roleBindingRules: roleBindingRules});
        });
        this.selectFilteredNamespacesRoleBindingRules.next(this.selectNamespacedRoleBindingRules);
    }


    calculateVisibleObjects() {
        if (this.selectedSubjects.length == 0 && this.selectedRoleBindings.length == 0 &&
            this.selectedRoles.length == 0 && this.selectedRoleBindingRule.length == 0) {

            this.visibleUsers = this.selectSubjects.get('User');
            this.visibleGroups = this.selectSubjects.get('Group');
            this.visibleServiceAccounts = this.selectSubjects.get('ServiceAccount');

            this.visibleRoles = this.selectRoles.get('Role');
            this.visibleClusterRoles = this.selectRoles.get('ClusterRole');

            this.visibleRoleBindings = this.selectRoleBindings.get('RoleBinding');
            this.visibleClusterRoleBindings = this.selectRoleBindings.get('ClusterRoleBinding');

            this.visibleNamespacedRoleBindingRules = [];

            let roleBindingRulesMap = this.convertMappingsToRoleBindingRules(this.rbac.mappings);
            roleBindingRulesMap.forEach((roleBindingRules: RoleBindingRule[], ns: string) => {
                this.visibleNamespacedRoleBindingRules.push({namespace: ns, roleBindingRules: roleBindingRules});
            });

        } else {

            let selectedSubjectsIds = this.selectedSubjects.map(s => s.id);
            let selectedRoleBindingIds = this.selectedRoleBindings.map(s => s.id);
            let selectedRoleIds = this.selectedRoles.map(s => s.id);
            let selectedRuleIds = this.selectedRoleBindingRule.map(s => s.rule.id);

            let filteredMappings = this.rbac.mappings;

            if (selectedSubjectsIds.length > 0) {
                // filter mappings for subjects (multiple subjects with or)
                filteredMappings = filteredMappings.filter(m => selectedSubjectsIds.indexOf(m.subjectID) > -1);
            }

            if (selectedRoleBindingIds.length > 0) {
                // filter mappings for rolebindings
                filteredMappings = filteredMappings.filter(m => selectedRoleBindingIds.indexOf(m.roleBindingID) > -1);
            }

            if (selectedRoleIds.length > 0) {
                // filter mappings for roles
                filteredMappings = filteredMappings.filter(m => selectedRoleIds.indexOf(m.roleID) > -1);
            }

            if (selectedRuleIds.length > 0) {
                // filter mappings for rules
                filteredMappings = filteredMappings.filter(m => selectedRuleIds.indexOf(m.ruleID) > -1);
            }

            let filteredSubjects = filteredMappings.map(m => m.subjectID);
            let filteredRoleBindings = filteredMappings.map(m => m.roleBindingID);
            let filteredRoles = filteredMappings.map(m => m.roleID);


            this.visibleUsers = this.selectSubjects.get('User').filter(s => filteredSubjects.indexOf(s.id) > -1);
            this.visibleGroups = this.selectSubjects.get('Group').filter(s => filteredSubjects.indexOf(s.id) > -1);
            this.visibleServiceAccounts = this.selectSubjects.get('ServiceAccount').filter(s => filteredSubjects.indexOf(s.id) > -1);


            this.visibleRoleBindings = this.selectRoleBindings.get('RoleBinding').filter(s => filteredRoleBindings.indexOf(s.id) > -1);
            this.visibleClusterRoleBindings = this.selectRoleBindings.get('ClusterRoleBinding').filter(s => filteredRoleBindings.indexOf(s.id) > -1);


            this.visibleRoles = this.selectRoles.get('Role').filter(s => filteredRoles.indexOf(s.id) > -1);
            this.visibleClusterRoles = this.selectRoles.get('ClusterRole').filter(s => filteredRoles.indexOf(s.id) > -1);

            this.visibleNamespacedRoleBindingRules = [];
            let roleBindingRulesMap = this.convertMappingsToRoleBindingRules(filteredMappings);
            roleBindingRulesMap.forEach((roleBindingRules: RoleBindingRule[], ns: string) => {
                this.visibleNamespacedRoleBindingRules.push({namespace: ns, roleBindingRules: roleBindingRules});
            });
        }
    }

    convertMappingsToRoleBindingRules(mappings: Mapping[]): Map<string, Array<RoleBindingRule>> {
        let roleBindingsRulesMap = new Map<string, Array<RoleBindingRule>>();
        mappings.map(m => this.getRoleBindingRule(m.roleBindingID, m.ruleID))
            .forEach(roleBindingRule => {
                let namespace = roleBindingRule.roleBinding.namespace;
                if (!namespace) {
                    namespace = 'ClusterWide';
                }
                let roleBindingRules = roleBindingsRulesMap.get(namespace);
                if (!roleBindingRules) {
                    roleBindingRules = [];
                }
                roleBindingRules.push(roleBindingRule);

                roleBindingsRulesMap.set(namespace, roleBindingRules);
            });

        roleBindingsRulesMap.forEach((roleBindingRules: RoleBindingRule[], namespace: string) => {
            roleBindingsRulesMap.set(namespace, roleBindingRules.sort((a,b)=> a.rule.display.localeCompare(b.rule.display)));
        });

        return roleBindingsRulesMap;
    }

    getRoleBindingRule(roleBindingID: string, ruleID: string) {
        let rbr = new RoleBindingRule();
        rbr.roleBinding = this.rbac.roleBindings[roleBindingID];
        rbr.rule = this.rbac.rules[ruleID];

        let display = '';
        if (rbr.rule.apiGroup != '') {
            display += rbr.rule.apiGroup + '/';
        }
        display += rbr.rule.resource;
        if (rbr.rule.resourceName != '') {
            display += ':' + rbr.rule.resourceName;
        }
        display += ':[' + rbr.rule.verbs + ']';
        rbr.rule.display = display;

        return rbr;
    }

    ngOnInit(): void {

    }

    filterSubjects() {
        if (!this.selectSubjects) {
            return;
        }
        let search = this.subjectFilterCtrl.value;
        if (!search) {
            this.selectFilteredUsers.next(this.selectSubjects.get('User'));
            this.selectFilteredGroups.next(this.selectSubjects.get('Group'));
            this.selectFilteredServiceAccounts.next(this.selectSubjects.get('ServiceAccount'));
        } else {
            search = search.toLowerCase();
        }
        this.selectFilteredUsers.next(this.selectSubjects.get('User').filter(subject => {
            return subject.name.toLowerCase().search(search) > -1;
        }));
        this.selectFilteredGroups.next(this.selectSubjects.get('Group').filter(subject => {
            return subject.name.toLowerCase().search(search) > -1;
        }));
        this.selectFilteredServiceAccounts.next(this.selectSubjects.get('ServiceAccount').filter(subject => {
            return subject.name.toLowerCase().search(search) > -1;
        }));
    }

    resetSubjectFilter() {
        this.selectedSubjects = [];
        this.calculateVisibleObjects();
    }


    filterRoleBindings() {
        if (!this.selectRoleBindings) {
            return;
        }
        let search = this.roleBindingFilterCtrl.value;
        if (!search) {
            this.selectFilteredRoleBindings.next(this.selectRoleBindings.get('RoleBinding'));
            this.selectFilteredClusterRoleBindings.next(this.selectRoleBindings.get('ClusterRoleBinding'));
        } else {
            search = search.toLowerCase();
        }
        this.selectFilteredRoleBindings.next(this.selectRoleBindings.get('RoleBinding').filter(roleBinding => {
            return roleBinding.name.toLowerCase().search(search) > -1;
        }));
        this.selectFilteredClusterRoleBindings.next(this.selectRoleBindings.get('ClusterRoleBinding').filter(roleBinding => {
            return roleBinding.name.toLowerCase().search(search) > -1;
        }));
    }

    resetRoleBindingFilter() {
        this.selectedRoleBindings = [];
        this.calculateVisibleObjects();
    }


    filterRoles() {
        if (!this.selectRoles) {
            return;
        }
        let search = this.roleFilterCtrl.value;
        if (!search) {
            this.selectFilteredRoles.next(this.selectRoles.get('Role'));
            this.selectFilteredClusterRoles.next(this.selectRoles.get('ClusterRole'));
        } else {
            search = search.toLowerCase();
        }
        this.selectFilteredRoles.next(this.selectRoles.get('Role').filter(role => {
            return role.name.toLowerCase().search(search) > -1;
        }));
        this.selectFilteredClusterRoles.next(this.selectRoles.get('ClusterRole').filter(role => {
            return role.name.toLowerCase().search(search) > -1;
        }));
    }

    resetRoleFilter() {
        this.selectedRoles = [];
        this.calculateVisibleObjects();
    }

    filterRules() {
        if (!this.selectNamespacedRoleBindingRules) {
            return;
        }
        let search = this.roleBindingRuleFilterCtrl.value;
        if (!search) {
            this.selectFilteredNamespacesRoleBindingRules.next(this.selectNamespacedRoleBindingRules);
        } else {
            search = search.toLowerCase();
        }
        let filteredSelectRules = this.selectNamespacedRoleBindingRules.map(nrr => {
                let newNRR = new NamespacedRoleBindingRule();
                newNRR.namespace = nrr.namespace;
                newNRR.roleBindingRules = nrr.roleBindingRules.filter(roleBindingRule => {
                    return roleBindingRule.rule.display.toLowerCase().search(search) > -1;
                });
                return newNRR;
            }
        );
        this.selectFilteredNamespacesRoleBindingRules.next(filteredSelectRules);
    }

    resetRuleFilter() {
        this.selectedRoleBindingRule = [];
        this.calculateVisibleObjects();
    }
}
