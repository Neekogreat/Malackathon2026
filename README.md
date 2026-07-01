# Malackathon2026
## 🚀 Inicio Rápido con Docker

Levanta los dos modelos en Ollama y la base de datos en Mongo en segundo plano (detached)
```bash
docker compose up -d
```

Para comprobar si el contenedor se está ejecutando correctamente, utiliza: 
```bash
docker ps
```

En MongoDB Compass, usa esta URI:
```bash
mongodb://admin:admin123@localhost:27017/?authSource=admin
```
