// Initialisation des variables pour le WebSocket
let socket;
let serverUrl = "ws://0.0.0.0:3001"; // Adresse IP publique
let apiKey = "DUDUDUDU MAX VERSTAPPEN"; // Clé API
let messageQueue = []; // File d'attente des messages à envoyer

// Fonction pour initialiser la connexion WebSocket
function initializeWebSocket() {
  socket = new WebSocket(serverUrl);

  socket.onopen = () => {
    console.log("Connexion WebSocket établie avec le serveur Node.js");

    // Envoyer la clé API pour authentification
    socket.send(JSON.stringify({ action: "authenticate", token: apiKey }));

    // Envoyer tous les messages en attente
    while (messageQueue.length > 0) {
      const { action, data } = messageQueue.shift();
      sendToWebSocket(action, data);
    }
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Message WebSocket reçu :", message);

      // Traiter les actions envoyées par le serveur Node.js
      switch (message.action) {
        case "authenticated":
          console.log("Authentification réussie avec le serveur WebSocket.");
          break;

        case "actorUpdated":
          console.log("Mise à jour reçue depuis le serveur :", message.data);
          handleActorUpdate(message.data);
          break;

        case "deleteActor":
          console.log("Suppression reçue depuis le serveur :", message.data.id);
          handleActorDeletion(message.data.id);
          break;

        case "error":
          console.error("Erreur reçue du serveur :", message.message);
          break;

        default:
          console.warn("Action non reconnue depuis le serveur :", message.action);
      }
    } catch (error) {
      console.error("Erreur lors du traitement du message WebSocket :", error);
    }
  };

  socket.onerror = (error) => {
    console.error("Erreur WebSocket :", error);
  };

  socket.onclose = () => {
    console.warn("Connexion WebSocket fermée. Tentative de reconnexion dans 5 secondes.");
    setTimeout(initializeWebSocket, 5000); // Réessayer après 5 secondes
  };
}

// Gérer la mise à jour d'un acteur
function handleActorUpdate(data) {
  if (!data || !data._id) {
    console.warn("Données de mise à jour invalides :", data);
    return;
  }

  const actor = game.actors.get(data._id);
  if (actor) {
    actor
      .update(data)
      .then(() => console.log(`Mise à jour appliquée avec succès à l'acteur ${data._id}`))
      .catch((err) => console.error(`Erreur lors de la mise à jour de l'acteur ${data._id} :`, err));
  } else {
    console.warn(`Acteur introuvable pour l'ID : ${data._id}, mise à jour ignorée.`);
  }
}

// Gérer la suppression d'un acteur
function handleActorDeletion(actorId) {
  if (!actorId) {
    console.warn("ID d'acteur non fourni pour la suppression.");
    return;
  }

  const actor = game.actors.get(actorId);
  if (actor) {
    actor
      .delete()
      .then(() => console.log(`Acteur supprimé avec succès : ${actorId}`))
      .catch((err) => console.error(`Erreur lors de la suppression de l'acteur ${actorId} :`, err));
  } else {
    console.warn(`Acteur introuvable pour suppression : ${actorId}`);
  }
}

// Fonction pour envoyer des données au serveur WebSocket
function sendToWebSocket(action, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = { action, data };
    console.log("Envoi au serveur WebSocket :", payload);
    socket.send(JSON.stringify(payload));
  } else {
    console.warn("WebSocket non connecté. Ajout du message à la file d'attente.");
    messageQueue.push({ action, data });
  }
}

// Hooks pour capturer les événements et synchroniser avec le serveur
Hooks.on("createActor", (actor, options, userId) => {
  if (game.user.isGM) {
    const actorData = actor.toJSON();
    console.log("Acteur créé, synchronisation avec le serveur :", actorData);
    sendToWebSocket("actorCreated", actorData);
  }
});

Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (game.user.isGM) {
    const actorData = actor.toJSON();
    console.log("Acteur mis à jour, synchronisation avec le serveur :", actorData);
    sendToWebSocket("actorUpdated", actorData);
  }
});

Hooks.on("deleteActor", (actor, options, userId) => {
  if (game.user.isGM) {
    console.log("Acteur supprimé, synchronisation avec le serveur :", actor.id);
    sendToWebSocket("deleteActor", { id: actor.id });
  }
});

// Initialisation du module
Hooks.once("init", () => {
  console.log("Module Actor Synchronization chargé.");

  // Enregistrer les paramètres du module
  game.settings.register("actor-sync", "websocketUrl", {
    name: "URL du serveur WebSocket",
    hint: "Entrez l'URL du serveur WebSocket (par défaut : ws://0.0.0.0:3001)",
    scope: "world",
    config: true,
    default: "ws://0.0.0.0:3001",
    type: String,
    onChange: (value) => {
      serverUrl = value;
      initializeWebSocket();
    },
  });

  game.settings.register("actor-sync", "apiKey", {
    name: "Clé API",
    hint: "Entrez la clé API pour sécuriser la connexion avec le serveur WebSocket",
    scope: "world",
    config: true,
    default: "votre-cle-secrete",
    type: String,
    onChange: (value) => {
      apiKey = value;
      initializeWebSocket();
    },
  });

  // Lire les paramètres utilisateur et initialiser la connexion WebSocket
  serverUrl = game.settings.get("actor-sync", "websocketUrl");
  apiKey = game.settings.get("actor-sync", "apiKey");

  initializeWebSocket();
});














  