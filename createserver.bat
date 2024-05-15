@echo off
REM Verifica si existe la variable de entorno "CONTADOR"
if not defined CONTADOR set CONTADOR=5

REM Define el puerto como 4000 más el valor del contador
set /A PORT=5020+%CONTADOR%

REM Define el nombre de la imagen como "server" seguido del número del contador
set IMAGEN=server%CONTADOR%

REM Define el nombre del contenedor como "server" seguido del número del contador
set CONTENEDOR=server%CONTADOR%

REM Incrementa el contador para la próxima ejecución
set /A CONTADOR+=1

REM Puerto de mapeo del contenedor (puerto del host:puerto del contenedor)
set PUERTO_MAPEADO=%PORT%:%PORT%

REM Generar un ID de nodo aleatorio entre 7 y 21
set /a "NODE_ID=(%RANDOM% %% 15) + 7"


REM Ruta completa al directorio que contiene el Dockerfile
set DOCKERFILE_DIR=C:\Users\ACER_COREI5\Documents\GitHub\BullyNodes

REM Agregar registro para mostrar información sobre el puerto y la imagen
echo Construyendo contenedor con los siguientes parámetros:
echo Puerto: %PORT%
echo Imagen: %IMAGEN%
echo Contenedor: %CONTENEDOR%
echo El ID de nodo generado es %NODE_ID%
echo Puerto mapeado: %PUERTO_MAPEADO%

REM Construye y ejecuta el comando Docker
docker build -t %IMAGEN% --build-arg PORT=%PORT% -f %DOCKERFILE_DIR%\Dockerfile-Server-Auto %DOCKERFILE_DIR%
docker run -d -p %PUERTO_MAPEADO% --name %CONTENEDOR% -e NODE_NAME=NODO%CONTADOR% -e NODE_SERVICE_IP=172.17.0.%CONTADOR% -e NODE_SERVICE_PORT=%PORT% -e NODE_ID=%NODE_ID% -e NODE_VERSION=18.19.1 -e PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin -e YARN_VERSION=1.22.19 %IMAGEN%

echo Contenedor creado exitosamente con nombre de imagen: %IMAGEN% y puerto mapeado: %PUERTO_MAPEADO%.

REM Guarda el valor actual del contador para la próxima ejecución
setx CONTADOR %CONTADOR%
