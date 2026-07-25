# UNO — Expo (multijoueur par code)

Un jeu de **UNO** multijoueur où l'on rejoint une partie avec un **code**.
Prêt à lancer sur **Expo Go (SDK 54)**. Aucun backend à déployer : le temps réel
passe par un **broker MQTT public gratuit** (WebSocket), donc ça marche tout de suite.

## 🚀 Lancer (depuis Termux)

```bash
cd uno-app
npm install
npx expo start
```

Puis :

1. Ouvre l'appli **Expo Go** sur ton téléphone (version SDK 54).
2. Scanne le **QR code** affiché dans le terminal.
   - Si le téléphone et l'ordi ne sont pas sur le même Wi-Fi, lance en mode tunnel :
     `npx expo start --tunnel`.

> Astuce Termux : si le QR ne se scanne pas, appuie sur `s` pour basculer en
> « Expo Go », et utilise le lien `exp://…` affiché.

## 🎮 Comment jouer

1. **Un joueur** crée la partie → il obtient un **code** (ex. `K7P2M`).
2. **Les autres** entrent ce code et rejoignent le salon.
3. L'hôte appuie sur **Lancer la partie** (2 à 8 joueurs).
4. Règles UNO classiques :
   - jouer une carte de même **couleur** ou même **valeur** que celle du dessus ;
   - **+2**, **Passe** (⦸), **Sens inverse** (⇄), **Joker** (★), **+4** ;
   - piocher si on ne peut pas jouer (bouton **Passer** ensuite) ;
   - premier à vider sa main **gagne**. Une carte en main = **UNO !**

## 🧩 Architecture

| Fichier | Rôle |
|---|---|
| `src/engine.js` | Moteur de jeu UNO (logique pure, testée) |
| `src/net.js` | Transport temps réel MQTT/WebSocket + codes de partie |
| `src/components/Card.js` | Rendu d'une carte |
| `App.js` | Écrans (accueil, salon, partie) et orchestration |

**Modèle :** l'hôte fait autorité. Tout le monde publie ses actions sur le
broker ; l'hôte les valide avec le moteur et rediffuse l'état. Les invités
affichent l'état reçu.

## 🔧 Changer de broker

Un seul endroit à modifier — `src/net.js` :

```js
export const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
```

Autres brokers publics MQTT/WSS possibles (l'hôte **et** les invités doivent
utiliser le même) :

- `wss://test.mosquitto.org:8081/mqtt`
- `wss://broker.hivemq.com:8884/mqtt`

## ⚠️ Notes

- Le broker est **public** : pour une partie entre amis c'est parfait, mais
  l'état complet transite en clair. Les codes de partie sont aléatoires
  (32⁵ ≈ 33 M combinaisons) pour éviter les collisions.
- Si l'hôte quitte, la partie s'arrête (modèle hôte-autoritaire).
