CLIENT=npm
for package in react-bootstrap; do
  echo "Packge: $package"
  curl "localhost:3000/export-sizes?p=$package&client=$CLIENT" -w "\n%{time_total}"
done
