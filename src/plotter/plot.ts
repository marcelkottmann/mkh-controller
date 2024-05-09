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
const svgFlatten = require("svg-flatten");

const MAX_PLOT_LENGTH = 50;

async function driveToPoint(
  controller: MKH40Controller | undefined,
  x: number,
  y: number
) {
  console.log("Plot", x, -y);

  if (controller) {
    let speedX = MAX_SPEED / 2;
    let speedY = MAX_SPEED / 2;

    const previousX = await controller.getCurrentPosition(Motor.B);
    const previousY = -(await controller.getCurrentPosition(Motor.A));

    const deltaX = Math.abs(x - previousX);
    const deltaY = Math.abs(y - previousY);

    if (deltaX > deltaY) {
      speedY = (deltaY * speedY) / deltaX;
    } else {
      speedX = (deltaX * speedX) / deltaY;
    }

    await controller.driveMotorToPosition(
      { position: -y, speed: speedY },
      { position: x, speed: speedX }
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
    await moveMotorAbsolute(controller, Motor.C, -40);
  } else {
    await delay(500);
  }
}

async function moveMotorRelative(
  controller: MKH40Controller,
  motor: Motor,
  delta: number
) {
  const posA = await controller.getCurrentPosition(Motor.A);
  const posB = await controller.getCurrentPosition(Motor.B);
  const posC = await controller.getCurrentPosition(Motor.C);
  const posD = await controller.getCurrentPosition(Motor.D);

  const speed = MAX_SPEED / 8;
  await controller.driveMotorToPosition(
    {
      position: posA + (motor === Motor.A ? delta : 0),
      speed: motor === Motor.A ? speed : 0,
    },
    {
      position: posB + (motor === Motor.B ? delta : 0),
      speed: motor === Motor.B ? speed : 0,
    },
    {
      position: posC + (motor === Motor.C ? delta : 0),
      speed: motor === Motor.C ? speed : 0,
    },
    {
      position: posD + (motor === Motor.D ? delta : 0),
      speed: motor === Motor.D ? speed : 0,
    }
  );
}

async function moveMotorAbsolute(
  controller: MKH40Controller,
  motor: Motor,
  pos: number
) {
  const posA = await controller.getCurrentPosition(Motor.A);
  const posB = await controller.getCurrentPosition(Motor.B);
  const posC = await controller.getCurrentPosition(Motor.C);
  const posD = await controller.getCurrentPosition(Motor.D);

  const speed = MAX_SPEED / 8;
  await controller.driveMotorToPosition(
    {
      position: motor === Motor.A ? pos : posA,
      speed: motor === Motor.A ? speed : 0,
    },
    {
      position: motor === Motor.B ? pos : posB,
      speed: motor === Motor.B ? speed : 0,
    },
    {
      position: motor === Motor.C ? pos : posC,
      speed: motor === Motor.C ? speed : 0,
    },
    {
      position: motor === Motor.D ? pos : posD,
      speed: motor === Motor.D ? speed : 0,
    }
  );
}

async function moveMotorForward(
  controller: MKH40Controller | undefined,
  motor: Motor
) {
  console.log(`Motor ${motor} - forward`);
  if (controller) {
    await moveMotorRelative(controller, motor, 20);
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
    await moveMotorRelative(controller, motor, -20);
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
    const posA = await controller.getCurrentPosition(Motor.A);
    const posB = await controller.getCurrentPosition(Motor.B);
    const posC = await controller.getCurrentPosition(Motor.C);
    const posD = await controller.getCurrentPosition(Motor.D);
    console.log(posA, posB, posC, posD);
  } else {
    await delay(500);
    console.log(`Print motor positions`);
  }
}

function calibrate(controller: MKH40Controller | undefined): Promise<void> {
  let selectedMotor = Motor.A;
  console.log(`Calibration...`);
  console.log(`Type 'e' to exit calibration.`);
  console.log(`Type 'c' to save calibration.`);
  console.log(`Type 'n' to drive to initial pose.`);
  console.log(`Type right arrow to switch motors.`);
  console.log(`Type right up/down arrows to move selected motor.`);
  console.log(`Type 'p' to print motor positions.`);

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
      } else if (keystroke[0] === "e".charCodeAt(0)) {
        process.stdin.setRawMode(false);
        return resolve();
      } else if (keystroke[0] === "c".charCodeAt(0)) {
        resetMotorPositions(controller);
      } else if (keystroke[0] === "p".charCodeAt(0)) {
        printMotorPositions(controller);
      } else if (keystroke[0] === "n".charCodeAt(0)) {
        moveUp(controller).then(() => driveToPoint(controller, 0, 0));
      }
    });
  });
}

async function plot(controller: MKH40Controller | undefined, file: string) {
  await calibrate(controller);
  let content = await fs.readFile(file, { encoding: "utf-8" });

  const svg = parse(content);
  const pathElements: ElementNode[] = [];
  collectPaths(pathElements, svg.children);

  const paths = pathElements.map(
    (pe) =>
      new SVGPathCommander(pe.properties?.d as string)
        .toAbsolute()
        .transform({ scale: [1, 10], origin: [0, 0] }).segments
  );

  await fs.writeFile("./out.svg",`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <!-- Created with Inkscape (http://www.inkscape.org/) -->
  
  <svg
     width="210mm"
     height="297mm"
     viewBox="0 0 210 297"
     version="1.1"
     id="svg5"
     inkscape:version="1.2.2 (b0a8486541, 2022-12-01)"
     sodipodi:docname="test.svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:svg="http://www.w3.org/2000/svg">
  ${paths.map(path=>`<path d="${SVGPathCommander.pathToString(path)}"/>`)}`);
  // process.exit() as any;
  // console.log(flattened);

  const overallBBox = getOverallBBox(paths);
  console.log("Overall Bounding Box:", overallBBox);

  // process.exit() as any;

  if (!overallBBox) {
    throw Error("Cannot determine bounding box");
  }

  await moveUp(controller);
  for (const path of paths) {
    const pathLength = SVGPathCommander.getTotalLength(path);
    const plotLength = transformLength(pathLength, overallBBox);
    const sections = Math.ceil(plotLength / MAX_PLOT_LENGTH);

    const points = pointsOnPath(SVGPathCommander.pathToString(path));
    for (let i = 0; i < points[0].length; i++) {
      if (i === 1) {
        await moveDown(controller);
      }
      // const point = SVGPathCommander.getPointAtLength(
      //   path,
      //   (pathLength * i) / sections
      // );
      const plotPoint = transformToPlotCoord(
        points[0][i][0],
        points[0][i][1],
        overallBBox
      );
      await driveToPoint(controller, plotPoint.x, plotPoint.y);
    }
    await moveUp(controller);
  }
  await driveToPoint(controller, 0, 0);
}

const mock = false;

if (mock) {
  plot(undefined, "./src/plotter/test.svg");
} else {
  initializeMKHController(async (controller) => {
    await plot(controller, "./src/plotter/test.svg");
  });
}
