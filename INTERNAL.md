
# Update Angular Go Package

````
./build.sh
````


# Test Netpol

````
export KUBECONFIG=/home/fedora/.kube/config_minikube

helm init
helm upgrade prom stable/prometheus  --install --set networkPolicy.enabled=true 
````