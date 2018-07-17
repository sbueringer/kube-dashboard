import
{ Component, OnInit} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-priority',
  templateUrl: './priority.component.html',
  styleUrls: [ './priority.component.css' ]
})
export class PriorityComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,

    private location: Location
  ) {}

  ngOnInit(): void {

  }

  goBack(): void {
    this.location.back();
  }
}


/*
Copyright 2017-2018 Google Inc. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at http://angular.io/license
*/