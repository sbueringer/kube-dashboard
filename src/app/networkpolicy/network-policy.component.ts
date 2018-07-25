import
{Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Location} from '@angular/common';
import {KubeService} from '../kube.service';
import {NetPol, NetworkPolicy, Pod} from '../netpol';

@Component({
    selector: 'app-network-policy',
    templateUrl: './network-policy.component.html',
    styleUrls: ['./network-policy.component.css']
})
export class NetworkPolicyComponent implements OnInit {

    private netPol: NetPol;

    private allNamespaces: String[] = [];
    private selectedNamespaces: String[] = [];

    private allPods: Pod[] = [];
    private selectedPods: Pod[] = [];
    private filteredPods: Pod[] = [];

    private allNetworkPolicies: NetworkPolicy[] = [];
    private selectedNetworkPolicies: NetworkPolicy[] = [];
    private filteredNetworkPolicies: NetworkPolicy[] = [];

    constructor(
        private route: ActivatedRoute,
        private kubeService: KubeService
    ) {

        this.refreshNetPol();

        this.kubeService.commandSent$.subscribe( cmd => {
            if (cmd == "refreshNetPol"){
                this.refreshNetPol();
            }
        })
    }

    private refreshNetPol() {
        this.kubeService.getNetPol().subscribe(newNetPol => {
            this.netPol = newNetPol;

            this.allPods = this.netPol.pods;
            this.allNetworkPolicies = this.netPol.networkPolicies;

            this.allNamespaces = Array.from(new Set(this.allPods.map(p => p.metadata.namespace)));
        });
    }

    updateFiltering() {
        this.calculateVisibleObjects();
    }

    calculateVisibleObjects() {
        if (this.selectedNamespaces && this.selectedNamespaces.length == 0) {
            this.filteredPods = this.allPods;
            this.filteredNetworkPolicies = this.allNetworkPolicies;
        }
        else {
            this.filteredPods = this.allPods.filter(p => this.selectedNamespaces.indexOf(p.metadata.namespace) > -1);
            this.filteredNetworkPolicies = this.allNetworkPolicies.filter(n => this.selectedNamespaces.indexOf(n.metadata.namespace) > -1);
        }
    }

    ngOnInit(): void {

    }
}


/*
Copyright 2017-2018 Google Inc. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at http://angular.io/license
*/