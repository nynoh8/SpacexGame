import { v4 as uuidv4 } from "uuid";

export type PartType = "box" | "cylinder" | "cone";

export interface Part {
  id: string;
  type: PartType;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
}

const baseColors = ["#2a2a2a", "#3b3b3b", "#4c4c4c", "#1a1a1a"];
const accentColors = [
  "#ff3333",
  "#3366ff",
  "#ffcc00",
  "#00cc66",
  "#ff9900",
  "#cc00ff",
  "#ffffff",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSpaceship(): Part[] {
  const parts: Part[] = [];
  const primaryColor = randomChoice(baseColors);
  const secondaryColor = randomChoice(baseColors);
  const accentColor = randomChoice(accentColors);
  const glassColor = "#44ccff";

  const getThemeColor = () => {
    const r = Math.random();
    if (r < 0.6) return primaryColor;
    if (r < 0.9) return secondaryColor;
    return accentColor;
  };

  // Main hull
  const hullLength = 4 + Math.random() * 8;
  const hullWidth = 1 + Math.random() * 3;
  const hullHeight = 1 + Math.random() * 2;

  parts.push({
    id: uuidv4(),
    type: "box",
    position: [0, 0, 0],
    scale: [hullWidth, hullHeight, hullLength],
    rotation: [0, 0, 0],
    color: primaryColor,
  });

  // Cockpit
  const cockpitLength = 1 + Math.random() * 2;
  const cockpitWidth = hullWidth * (0.4 + Math.random() * 0.4);
  const cockpitHeight = 0.5 + Math.random() * 1.5;
  const cockpitZ = Math.random() * (hullLength / 2) - cockpitLength / 2;

  parts.push({
    id: uuidv4(),
    type: "box",
    position: [0, hullHeight / 2 + cockpitHeight / 2, cockpitZ],
    scale: [cockpitWidth, cockpitHeight, cockpitLength],
    rotation: [0, 0, 0],
    color: secondaryColor,
  });

  // Cockpit Glass
  parts.push({
    id: uuidv4(),
    type: "box",
    position: [
      0,
      hullHeight / 2 + cockpitHeight / 2 + 0.1,
      cockpitZ + cockpitLength / 2 + 0.1,
    ],
    scale: [cockpitWidth * 0.8, cockpitHeight * 0.8, 0.2],
    rotation: [Math.PI / 8, 0, 0],
    color: glassColor,
  });

  // Wings
  const wingCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < wingCount; i++) {
    const wingSpan = 2 + Math.random() * 8;
    const wingLength = 1 + Math.random() * 5;
    const wingThickness = 0.2 + Math.random() * 0.8;
    const wingZ = -hullLength / 2 + Math.random() * hullLength * 0.8;
    const wingY = (Math.random() - 0.5) * hullHeight;
    const wingColor = getThemeColor();

    // Right wing
    parts.push({
      id: uuidv4(),
      type: "box",
      position: [hullWidth / 2 + wingSpan / 2, wingY, wingZ],
      scale: [wingSpan, wingThickness, wingLength],
      rotation: [0, 0, 0],
      color: wingColor,
    });

    // Left wing (mirrored)
    parts.push({
      id: uuidv4(),
      type: "box",
      position: [-(hullWidth / 2 + wingSpan / 2), wingY, wingZ],
      scale: [wingSpan, wingThickness, wingLength],
      rotation: [0, 0, 0],
      color: wingColor,
    });

    // Wing attachments / weapons / pods
    if (Math.random() > 0.3) {
      const podLength = 1 + Math.random() * 4;
      const podRadius = 0.2 + Math.random() * 0.6;
      const podColor = getThemeColor();
      const podType = Math.random() > 0.5 ? "cylinder" : "box";

      parts.push({
        id: uuidv4(),
        type: podType,
        position: [hullWidth / 2 + wingSpan, wingY, wingZ + wingLength / 4],
        scale:
          podType === "cylinder"
            ? [podRadius, podLength, podRadius]
            : [podRadius * 2, podRadius * 2, podLength],
        rotation: podType === "cylinder" ? [Math.PI / 2, 0, 0] : [0, 0, 0],
        color: podColor,
      });
      parts.push({
        id: uuidv4(),
        type: podType,
        position: [-(hullWidth / 2 + wingSpan), wingY, wingZ + wingLength / 4],
        scale:
          podType === "cylinder"
            ? [podRadius, podLength, podRadius]
            : [podRadius * 2, podRadius * 2, podLength],
        rotation: podType === "cylinder" ? [Math.PI / 2, 0, 0] : [0, 0, 0],
        color: podColor,
      });
    }
  }

  // Engines
  const engineCount = 1 + Math.floor(Math.random() * 3);
  const engineRadius = 0.4 + Math.random() * 1.2;
  const engineLength = 1 + Math.random() * 3;
  const engineColor = secondaryColor;
  const glowColor = accentColor;

  if (engineCount === 1 || Math.random() > 0.5) {
    // Single central engine
    parts.push({
      id: uuidv4(),
      type: "cylinder",
      position: [0, 0, -hullLength / 2 - engineLength / 2],
      scale: [engineRadius, engineLength, engineRadius],
      rotation: [Math.PI / 2, 0, 0],
      color: engineColor,
    });
    // Engine glow
    parts.push({
      id: uuidv4(),
      type: "cylinder",
      position: [0, 0, -hullLength / 2 - engineLength - 0.1],
      scale: [engineRadius * 0.8, 0.2, engineRadius * 0.8],
      rotation: [Math.PI / 2, 0, 0],
      color: glowColor,
    });
  }

  if (engineCount > 1) {
    // Paired engines
    const pairs = Math.floor(engineCount / 2) + (engineCount === 2 ? 1 : 0);
    for (let i = 0; i < pairs; i++) {
      const engineX = hullWidth / 2 + Math.random() * 2;
      const engineY = (Math.random() - 0.5) * hullHeight;
      parts.push({
        id: uuidv4(),
        type: "cylinder",
        position: [
          engineX,
          engineY,
          -hullLength / 2 - engineLength / 2 + Math.random(),
        ],
        scale: [engineRadius, engineLength, engineRadius],
        rotation: [Math.PI / 2, 0, 0],
        color: engineColor,
      });
      parts.push({
        id: uuidv4(),
        type: "cylinder",
        position: [
          -engineX,
          engineY,
          -hullLength / 2 - engineLength / 2 + Math.random(),
        ],
        scale: [engineRadius, engineLength, engineRadius],
        rotation: [Math.PI / 2, 0, 0],
        color: engineColor,
      });

      // Glows
      parts.push({
        id: uuidv4(),
        type: "cylinder",
        position: [engineX, engineY, -hullLength / 2 - engineLength - 0.1],
        scale: [engineRadius * 0.8, 0.2, engineRadius * 0.8],
        rotation: [Math.PI / 2, 0, 0],
        color: glowColor,
      });
      parts.push({
        id: uuidv4(),
        type: "cylinder",
        position: [-engineX, engineY, -hullLength / 2 - engineLength - 0.1],
        scale: [engineRadius * 0.8, 0.2, engineRadius * 0.8],
        rotation: [Math.PI / 2, 0, 0],
        color: glowColor,
      });
    }
  }

  // Greebles (small details on hull)
  const greebleCount = 5 + Math.floor(Math.random() * 15);
  for (let i = 0; i < greebleCount; i++) {
    const gSize = 0.2 + Math.random() * 0.8;
    const gX = (Math.random() - 0.5) * hullWidth;
    const gY = hullHeight / 2 + gSize / 2;
    const gZ = (Math.random() - 0.5) * hullLength;

    parts.push({
      id: uuidv4(),
      type: "box",
      position: [gX, gY, gZ],
      scale: [gSize, gSize, gSize],
      rotation: [0, 0, 0],
      color: getThemeColor(),
    });
    // Mirrored greeble if not central
    if (Math.abs(gX) > 0.2) {
      parts.push({
        id: uuidv4(),
        type: "box",
        position: [-gX, gY, gZ],
        scale: [gSize, gSize, gSize],
        rotation: [0, 0, 0],
        color: getThemeColor(),
      });
    }
  }

  return parts;
}
