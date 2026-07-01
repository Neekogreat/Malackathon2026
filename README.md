# Malackathon2026
## 🚀 Inicio Rápido con Docker

Puedes ejecutar esta instancia de MongoDB localmente usando Docker. Ejecuta el siguiente comando en tu terminal:

```bash
docker run -d \
  --name mongodb-proxy \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  -v mongodb_data:/data/db \
  mongo
```

Para comprobar si el contenedor se está ejecutando correctamente, utiliza: 
```bash
docker ps
```

En MongoDB Compass, usa esta URI:
```bash
mongodb://admin:admin123@localhost:27017/?authSource=admin
```
