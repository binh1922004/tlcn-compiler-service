echo "Starting the BNOJ Compiler Service..."
echo "Create necessary Docker volumes..."
docker volume create submission-data
docker volume create problem-data

echo "Build a docker image for compiler"
OJ_IMAGE=oj:4.0
docker build -t $OJ_IMAGE compiler/
echo "Run the compiler service container..."
COMPILER_SERVICE_IMAGE=bnoj-compiler:4.0
sudo docker run -d --name compiler-service -v /var/run/docker.sock:/var/run/docker.sock -v submission_data:/app/oj -v problem_data:/app/problems $COMPILER_SERVICE_IMAGE
