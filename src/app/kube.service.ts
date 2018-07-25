import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

import {Observable, of, Subject} from 'rxjs';
import {catchError} from 'rxjs/operators';

import {RBAC} from './rbac';
import {NetPol} from './netpol';


@Injectable({providedIn: 'root'})
export class KubeService {

    private backendUrl = 'http://localhost:8080/api';

    private command = new Subject<string>();
    commandSent$ = this.command.asObservable();

    constructor(private http: HttpClient) {
    }


    sendCommand(cmd: string) {
        this.command.next(cmd);
    }

    getRBAC(): Observable<RBAC> {
        return this.http.get<RBAC>(this.backendUrl+"/rbac")
            .pipe(
                catchError(this.handleError('getRBAC', new RBAC()))
            );
    }

    getNetPol(): Observable<NetPol> {
        return this.http.get<NetPol>(this.backendUrl+"/netpol")
            .pipe(
                catchError(this.handleError('getNetPol', new RBAC()))
            );
    }

    private handleError<T>(operation = 'operation', result?: T) {
        return (error: any): Observable<T> => {

            // TODO: send the error to remote logging infrastructure
            console.error(error); // log to console instead

            // Let the app keep running by returning an empty result.
            return of(result as T);
        };
    }

}
