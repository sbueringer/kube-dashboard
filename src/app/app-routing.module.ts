import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {RbacComponent} from "./rbac/rbac.component";
import {PriorityComponent} from "./priority/priority.component";

const routes: Routes = [
  { path: '', redirectTo: '/rbac', pathMatch: 'full' },
  { path: 'rbac', component: RbacComponent },
  { path: 'priority', component: PriorityComponent },
];

@NgModule({
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}


/*
Copyright 2017-2018 Google Inc. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at http://angular.io/license
*/