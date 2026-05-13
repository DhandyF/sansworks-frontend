#!/bin/bash
set -e

echo "=== Deploying SansWorks Frontend ==="

cd /var/www/sansworks/frontend

echo ">>> Pulling latest code..."
sudo -u deploy git pull origin main

echo ">>> Installing dependencies..."
sudo -u deploy npm install

echo ">>> Building..."
sudo -u deploy npm run build

echo "=== Frontend deployment complete! ==="