import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {MediaMatcher} from "@angular/cdk/layout";
import {OverlayContainer} from "@angular/cdk/overlay";
import {Router} from '@angular/router';
import {KubeService} from './kube.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
    mobileQuery: MediaQueryList;

    navMap = [
        { name: 'RBAC' , link: '/rbac'},
        { name: 'NetworkPolicy', link: '/netpol'}
    ];

    themeClass: string;

    private _mobileQueryListener: () => void;

    constructor(
        changeDetectorRef: ChangeDetectorRef,
        media: MediaMatcher,
        private overlayContainer: OverlayContainer,
        private router: Router,
        private rbacService:  KubeService,
        ) {

        this.mobileQuery = media.matchMedia('(max-width: 600px)');
        this._mobileQueryListener = () => changeDetectorRef.detectChanges();
        this.mobileQuery.addListener(this._mobileQueryListener);

        // subscribe to some source of theme change events, then...
        const newThemeClass = "my-theme";
        this.themeClass = newThemeClass;

        // remove old theme class and add new theme class
        // we're removing any css class that contains '-theme' string but your theme classes can follow any pattern
        const overlayContainerClasses = this.overlayContainer.getContainerElement().classList;
        const themeClassesToRemove = Array.from(overlayContainerClasses).filter((item: string) => item.includes('-theme'));
        if (themeClassesToRemove.length) {
            overlayContainerClasses.remove(...themeClassesToRemove);
        }
        overlayContainerClasses.add(newThemeClass);
    }

    refresh(): void {
        if (this.router.isActive("/rbac", false)){
            this.rbacService.sendCommand("refreshRBAC");
        }
        if (this.router.isActive("/netpol", false)){
            this.rbacService.sendCommand("refreshNetPol");
        }
    }

    ngOnDestroy(): void {
        this.mobileQuery.removeListener(this._mobileQueryListener);
    }

    ngOnInit() {
    }

}
