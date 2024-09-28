import { promises as fs } from "fs";
import { ElementNode, parse } from "svg-parser";
import SVGPathCommander from "svg-path-commander";
import { collectPaths } from "./collect-paths";
import { getOverallBBox } from "./overall-bbox";
import { transformLength, transformToPlotCoord } from "./scale";
import { delay } from "../util";
import { MAX_SPEED, MKH40Controller, Motor } from "../controller";
import { initializeMKHController } from "../start";
import { pointsOnPath } from "../points-on/points-on-path";
import { Path } from "./types";

async function driveToPoint(
  controller: MKH40Controller | undefined,
  x: number,
  y: number,
  previousX?: number,
  previousY?: number
) {
  x = Math.round(x);
  y = Math.round(y);

  if (previousX) {
    previousX = Math.round(previousX);
  }
  if (previousY) {
    previousY = Math.round(previousY);
  }

  console.log("Plot", x, -y);

  if (controller) {
    let speedX = MAX_SPEED;
    let speedY = MAX_SPEED;

    if (typeof previousX === "undefined" || typeof previousY === "undefined") {
      const pos = await controller.getCurrentPositions(Motor.B, Motor.A);
      previousX = pos[0];
      previousY = -pos[1];
    }

    const deltaX = Math.abs(x - previousX);
    const deltaY = Math.abs(y - previousY);

    if (deltaX === 0 && deltaY === 0) {
      // we are already at requested point
      return;
    }

    if (deltaX > deltaY) {
      speedY = (deltaY * speedY) / deltaX;
    } else {
      speedX = (deltaX * speedX) / deltaY;
    }

    await controller.driveMotorToPosition(
      [
        { motor: Motor.A, target: { position: -y, speed: speedY } },
        { motor: Motor.B, target: { position: x, speed: speedX } },
      ],
      { pollForMotorToReachPosition: true }
    );
  } else {
    await delay(500);
  }
}

async function moveUp(controller: MKH40Controller | undefined) {
  console.log("Move up");

  if (controller) {
    await moveMotorAbsolute(controller, Motor.C, 0);
  } else {
    await delay(500);
  }
}

async function moveDown(controller: MKH40Controller | undefined) {
  console.log("Move down");
  if (controller) {
    await moveMotorAbsolute(controller, Motor.C, -50);
  } else {
    await delay(500);
  }
}

async function moveMotorRelative(
  controller: MKH40Controller,
  motor: Motor,
  delta: number
) {
  const [posA, posB, posC, posD] = await controller.getCurrentPositions(
    Motor.A,
    Motor.B,
    Motor.C,
    Motor.D
  );

  const speed = MAX_SPEED / 2;
  await controller.driveMotorToPosition([
    {
      motor: Motor.A,
      target: {
        position: posA + (motor === Motor.A ? delta : 0),
        speed: motor === Motor.A ? speed : 0,
      },
    },
    {
      motor: Motor.B,
      target: {
        position: posB + (motor === Motor.B ? delta : 0),
        speed: motor === Motor.B ? speed : 0,
      },
    },
    {
      motor: Motor.C,
      target: {
        position: posC + (motor === Motor.C ? delta : 0),
        speed: motor === Motor.C ? speed : 0,
      },
    },
    {
      motor: Motor.D,
      target: {
        position: posD + (motor === Motor.D ? delta : 0),
        speed: motor === Motor.D ? speed : 0,
      },
    },
  ]);
}

async function moveMotorAbsolute(
  controller: MKH40Controller,
  motor: Motor,
  pos: number
) {
  const speed = MAX_SPEED / 2;
  await controller.driveMotorToPosition([
    {
      motor,
      target: {
        position: pos,
        speed: speed,
      },
    },
  ]);
}

async function moveMotorForward(
  controller: MKH40Controller | undefined,
  motor: Motor
) {
  console.log(`Motor ${motor} - forward`);
  if (controller) {
    await moveMotorRelative(controller, motor, 17);
  } else {
    await delay(500);
  }
}

async function moveMotorBackward(
  controller: MKH40Controller | undefined,
  motor: Motor
) {
  console.log(`Motor ${motor} - backward`);
  if (controller) {
    await moveMotorRelative(controller, motor, -17);
  } else {
    await delay(500);
  }
}

async function resetMotorPositions(controller: MKH40Controller | undefined) {
  console.log(`Reset motor positions`);
  if (controller) {
    await controller.resetMotorPosition(Motor.A, Motor.B, Motor.C, Motor.D);
  } else {
    await delay(500);
  }
}

async function printMotorPositions(controller: MKH40Controller | undefined) {
  if (controller) {
    const [posA, posB, posC, posD] = await controller.getCurrentPositions(
      Motor.A,
      Motor.B,
      Motor.C,
      Motor.D
    );
    console.log(posA, posB, posC, posD);
  } else {
    await delay(500);
    console.log(`Print motor positions`);
  }
}

function calibrate(controller: MKH40Controller | undefined): Promise<void> {
  let selectedMotor = Motor.A;
  console.log(`Calibration...`);
  console.log(`Type 'e' to exit program.`);
  console.log(`Type 'p' to start plotting.`);
  console.log(`Type 'c' to save calibration.`);
  console.log(`Type 'n' to drive to initial pose.`);
  console.log(`Type 'u' to move pen up.`);
  console.log(`Type 'd' to move pen down.`);
  console.log(`Type right arrow to switch motors.`);
  console.log(`Type right up/down arrows to move selected motor.`);
  console.log(`Type 'l' to print motor positions.`);

  console.log(
    "Move all motors to the initial pose (over the cross-hair with lifted pencil)."
  );

  console.log(`Selected motor: ${selectedMotor}`);

  return new Promise((resolve, reject) => {
    process.stdin.setRawMode(true);
    process.stdin.on("data", (keystroke) => {
      if (keystroke[0] === 0x1b && keystroke[1] === 0x5b) {
        if (keystroke[2] === 0x42) {
          moveMotorForward(controller, selectedMotor);
        } else if (keystroke[2] === 0x41) {
          moveMotorBackward(controller, selectedMotor);
        } else if (keystroke[2] === 0x43) {
          selectedMotor++;
          if (selectedMotor > Motor.D) {
            selectedMotor = Motor.A;
          }
          console.log(`Selected motor: ${selectedMotor}`);
        }
      } else if (keystroke[0] === "p".charCodeAt(0)) {
        process.stdin.setRawMode(false);
        return resolve();
      } else if (keystroke[0] === "e".charCodeAt(0) || keystroke[0] === 0x03) {
        process.stdin.setRawMode(false);
        process.exit(0);
      } else if (keystroke[0] === "c".charCodeAt(0)) {
        resetMotorPositions(controller);
      } else if (keystroke[0] === "l".charCodeAt(0)) {
        printMotorPositions(controller);
      } else if (keystroke[0] === "n".charCodeAt(0)) {
        moveUp(controller).then(() => driveToPoint(controller, 0, 0));
      } else if (keystroke[0] === "u".charCodeAt(0)) {
        moveUp(controller);
      } else if (keystroke[0] === "d".charCodeAt(0)) {
        moveDown(controller);
      }
    });
  });
}

function waitForSpace(): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdin.setRawMode(true);
    process.stdin.on("data", (keystroke) => {
      if (keystroke[0] === 32) {
        process.stdin.setRawMode(false);
        return resolve();
      }
    });
  });
}

function findColorFromStyle(style: string | number | undefined): string {
  if (typeof style === "string") {
    const match = style.match(/stroke:\s*([^;\s\"]+)/);
    if (match) {
      return match[1];
    }
  }
  return "default";
}

async function plot(controller: MKH40Controller | undefined, file: string) {
  await calibrate(controller);
  let content = await fs.readFile(file, { encoding: "utf-8" });

  const svg = parse(content);
  const pathElements: ElementNode[] = [];
  collectPaths(pathElements, svg.children);

  const allPaths: Path[] = pathElements.map((pe) => ({
    path: SVGPathCommander.pathToString(
      new SVGPathCommander(pe.properties?.d as string)
        .toAbsolute()
        .transform({ scale: [1, 10], origin: [0, 0] }).segments
    ),
    color: findColorFromStyle(pe.properties?.style),
    id: `${pe.properties?.id || ""}`,
  }));

  const colorToPath: Record<string, Path[]> = {};
  for (const path of allPaths) {
    let entry = colorToPath[path.color];
    if (!entry) {
      entry = colorToPath[path.color] = [];
    }
    entry.push(path);
  }

  const overallBBox = getOverallBBox(allPaths);
  console.log("Overall Bounding Box:", overallBBox);

  // process.exit() as any;

  if (!overallBBox) {
    throw Error("Cannot determine bounding box");
  }

  let previousX = undefined;
  let previousY = undefined;

  await moveUp(controller);
  for (const color of Object.keys(colorToPath)) {
    console.log(`Change pen to color "${color}" and press <Space>.`);
    await waitForSpace();

    for (const path of colorToPath[color]) {
      const points = pointsOnPath(path.path);

      for (let segment = 0; segment < points.length; segment++) {
        const lenPoints = points[segment].length;
        const closedPath =
          points[segment][lenPoints - 1][0] === points[segment][0][0] &&
          points[segment][lenPoints - 1][1] === points[segment][0][1];

        let moveDownIndex = 1;
        if (closedPath) {
          const lastTenPoints = points[segment].slice(
            Math.max(0, lenPoints - 10),
            lenPoints
          );
          points[segment].unshift(...lastTenPoints);
          moveDownIndex += lastTenPoints.length;
        }

        for (let i = 0; i < points[segment].length; i++) {
          if (i === moveDownIndex) {
            await moveDown(controller);
          }

          const x = points[segment][i][0];
          const y = points[segment][i][1];

          const plotPoint = transformToPlotCoord(x, y, overallBBox);

          await driveToPoint(
            controller,
            plotPoint.x,
            plotPoint.y,
            previousX,
            previousY
          );
          previousX = plotPoint.x;
          previousY = plotPoint.y;
        }
        await moveUp(controller);
      }
    }
  }
  await driveToPoint(controller, 0, 0, previousX, previousY);
}

const mock = false;

if (mock) {
  plot(undefined, "./src/plotter/test.svg");
} else {
  initializeMKHController(
    async (controller) => {
      await plot(controller, "./src/plotter/test.svg");
    },
    { log: false }
  );
}
