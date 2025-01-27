const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const readline = require("readline");

const app = express();
const port = 3000;

// Clé API pour sécuriser les requêtes et connexions
const API_KEY = "";

// Middleware pour parser les JSON
app.use(express.json());

// Servir l'interface web
app.use(express.static(path.join(__dirname, "public")));

// Middleware pour valider la clé API pour les requêtes HTTP
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Clé API invalide" });
  }
  next();
}

// Route pour exécuter une commande via l'interface
app.post("/api/command", validateApiKey, (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ success: false, message: "Commande invalide." });
  }

  try {
    const result = eval(command); // ⚠️ 
    console.log("Commande exécutée :", command);
    res.json({ success: true, message: "Commande exécutée avec succès.", result });
  } catch (err) {
    console.error("Erreur lors de l'exécution de la commande :", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'exécution de la commande.",
      error: err.message,
    });
  }
});

// WebSocket server
const wss = new WebSocket.Server({ host: "0.0.0.0", port: 3001 });

wss.on("connection", (ws) => {
  console.log("Client connecté via WebSocket");

  let authenticated = false;

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      // Authentification initiale
      if (!authenticated) {
        if (parsedMessage.action === "authenticate" && parsedMessage.token === API_KEY) {
          authenticated = true;
          ws.send(
            JSON.stringify({ action: "authenticated", message: "Connexion autorisée" })
          );
          console.log("Client WebSocket authentifié !");
        } else {
          ws.send(JSON.stringify({ action: "error", message: "Clé API invalide" }));
          ws.close();
        }
        return;
      }

      // Gestion des messages après authentification
      if (authenticated) {
        console.log("Message reçu :", parsedMessage);

        switch (parsedMessage.action) {
          case "actorUpdated":
            console.log("Mise à jour reçue pour l'acteur :", parsedMessage.data);
            broadcast({ action: "actorUpdated", data: parsedMessage.data }, ws);
            break;
          case "deleteActor":
            console.log("Suppression reçue pour l'acteur :", parsedMessage.data.id);
            broadcast({ action: "deleteActor", data: parsedMessage.data }, ws);
            break;
          default:
            console.warn("Action non reconnue :", parsedMessage.action);
        }
      }
    } catch (err) {
      console.error("Erreur lors du traitement du message WebSocket :", err);
    }
  });

  ws.on("close", () => {
    console.log("Client déconnecté");
  });

  ws.on("error", (err) => {
    console.error("Erreur WebSocket :", err);
  });
});

// Fonction pour diffuser un message à tous les clients WebSocket connectés
function broadcast(message, excludeClient = null) {
  const messageString = JSON.stringify(message);

  if (wss.clients.size === 0) {
    console.warn("Aucun client WebSocket connecté pour recevoir le message :", message);
    return;
  }

  wss.clients.forEach((client) => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      console.log("Diffusion du message :", message);
      client.send(messageString);
    }
  });
}

// Fonction pour envoyer une mise à jour spécifique à un acteur
function updateActorOnFoundry(actorId, updatedData) {
  if (!actorId || !updatedData) {
    console.error("Paramètres invalides pour updateActorOnFoundry");
    return;
  }

  const message = {
    action: "actorUpdated",
    data: {
      _id: actorId,
      ...updatedData,
    },
  };

  console.log("Envoi de la mise à jour au client WebSocket :", message);
  broadcast(message);
}

// Fonction pour envoyer une suppression spécifique à un acteur
function deleteActorOnFoundry(actorId) {
  if (!actorId) {
    console.error("Paramètre invalide pour deleteActorOnFoundry");
    return;
  }

  const message = {
    action: "deleteActor",
    data: { id: actorId },
  };

  console.log("Envoi de la suppression au client WebSocket :", message);
  broadcast(message);
}

// Lancement du serveur HTTP
app.listen(port, "0.0.0.0", () => {
  console.log(`Serveur Express en écoute sur http://0.0.0.0:${port}`);
  console.log(`Serveur WebSocket en écoute sur ws://0.0.0.0:3001`);
});

// Interface readline pour les commandes en direct
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Serveur> ",
});

rl.prompt();

rl.on("line", (input) => {
  const command = input.trim();

  try {
    if (command === "stop") {
      console.log("Arrêt du serveur...");
      process.exit(0);
    } else if (command.startsWith("global.updateActorOnFoundry")) {
      eval(command); // ⚠️ 
    } else if (command.startsWith("global.deleteActorOnFoundry")) {
      eval(command); // ⚠️ 
      console.log(`Commande inconnue : ${command}`);
    }
  } catch (err) {
    console.error("Erreur dans l'exécution de la commande :", err.message);
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("Interface console fermée.");
  process.exit(0);
});

// Exposition des fonctions globales
global.updateActorOnFoundry = updateActorOnFoundry;
global.deleteActorOnFoundry = deleteActorOnFoundry;












