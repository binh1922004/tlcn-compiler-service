docker volume create submission-data

docker volume create problem-data


sudo docker run --name compiler-service -v /var/run/docker.sock:/var/run/docker.sock -v compiler-service_submission-data:/app/oj -v compiler-service_problem-data:/app/problems bnoj-compiler:1.0
