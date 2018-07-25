
export class NetPol{
    pods: Pod[];
    networkPolicies: NetworkPolicy[];
}

export class Pod {
    metadata: MetaData;
}

export class NetworkPolicy {
    metadata: MetaData;
}

export class MetaData{
    name: string;
    namespace: string;
    labels: Map<string,string>;
}