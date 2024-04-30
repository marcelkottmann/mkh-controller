import noble from "@abandonware/noble";
import { ConnectState, DataListener } from "./start";
import { sendMessage } from "./communication";
import { bitmask, delay, hex } from "./util";

const STEP_FACTOR = 10000;

export interface SpeedAndPosition {
  speed: number;
  position: number;
}

export enum Direction {
  Right = "R",
  Left = "L",
}

export enum Motor {
  A = 1,
  B,
  C,
  D,
}

export async function createController(
  characteristic: noble.Characteristic,
  connectState: ConnectState,
  registerDataListener: (listener: DataListener) => void
): Promise<MKH40Controller> {
  await sendMessage(characteristic, "T041AABBW");
  await sendMessage(characteristic, "T00EW");
  await sendMessage(characteristic, "T01F1W");

  const backgroundJob = async () => {
    while (connectState.connected) {
      await sendMessage(characteristic, "T00CW");
      await delay(2000);
    }
  };
  backgroundJob();

  return new MKH40Controller(characteristic, registerDataListener);
}

interface SpeedAndDirection {
  speed: number;
  direction: Direction;
}

export class MKH40Controller {
  private listeners: {
    message: string;
    callback: (message: string) => void;
  }[] = [];

  private ready: Promise<void>;

  constructor(
    private characteristic: noble.Characteristic,
    registerDataListener: (listener: DataListener) => void
  ) {
    registerDataListener((data, isNotification) => {
      const message = data.toString("ascii");
      console.log(`notification:${isNotification} => ${message}`);
      for (let i = this.listeners.length - 1; i >= 0; i--) {
        const listener = this.listeners[i];
        if (message.startsWith(listener.message)) {
          this.listeners.splice(i, 1);
          listener.callback(message);
        }
      }
    });

    // wait for "ready" notification
    this.ready = new Promise((resolve) => {
      this.addListener("T01711W", () => resolve());
    });
  }

  private addListener(
    messagePrefix: string,
    callback: (message: string) => void
  ) {
    this.listeners.push({ message: messagePrefix, callback });
  }

  public stopAll() {
    return sendMessage(this.characteristic, "T14400000000000000000000W");
  }

  public async startMotor(
    motorA: SpeedAndDirection,
    motorB: SpeedAndDirection = { speed: 0, direction: Direction.Right },
    motorC: SpeedAndDirection = { speed: 0, direction: Direction.Right },
    motorD: SpeedAndDirection = { speed: 0, direction: Direction.Right }
  ) {
    await this.ready;
    return sendMessage(
      this.characteristic,
      `T1440${this.writeSpeedAndDirectionToMessage(
        motorA
      )}0${this.writeSpeedAndDirectionToMessage(
        motorB
      )}0${this.writeSpeedAndDirectionToMessage(
        motorC
      )}0${this.writeSpeedAndDirectionToMessage(motorD)}W`
    );
  }

  public async setLimits(
    motor: Motor,
    negativeLimit: number,
    positiveLimit: number
  ) {
    await this.ready;

    negativeLimit *= STEP_FACTOR;
    positiveLimit *= STEP_FACTOR;

    const message = `T149${bitmask(motor, 2)}${positiveLimit >= 0 ? "+" : "-"}${hex(
      positiveLimit,
      8
    )}${negativeLimit >= 0 ? "+" : "-"}${hex(negativeLimit, 8)}W`;
    return sendMessage(this.characteristic, message);
  }

  private validateSpeedAndDirection(motor: SpeedAndDirection) {
    if (motor.speed < 0) {
      throw Error(`Speed must not be a negative value: ${motor.speed}`);
    }

    if (motor.speed > 0x7fff) {
      throw Error(`Max speed exceeded: 0x${hex(motor.speed, 0)} > 0x7FFF`);
    }
  }

  private writeSpeedAndDirectionToMessage(motor: SpeedAndDirection) {
    this.validateSpeedAndDirection(motor);

    let speed = Math.round(motor.speed);

    if (motor.direction === Direction.Left) {
      speed += 0x8000;
    }

    return hex(speed, 4);
  }

  private validateSpeedAndPosition(motor: SpeedAndPosition) {
    if (motor.speed < 0) {
      throw Error(`Speed must not be a negative value: ${motor.speed}`);
    }

    if (motor.speed > 0x7fff) {
      throw Error(`Max speed exceeded: 0x${hex(motor.speed, 0)} > 0x7FFF`);
    }
  }

  private writeSpeedAndPositionToMessage(motor: SpeedAndPosition) {
    this.validateSpeedAndPosition(motor);

    const targetPosition = Math.round(motor.position * STEP_FACTOR);
    let speed = Math.round(motor.speed);

    if (targetPosition >= 0) {
      speed += 0x8000;
    }

    return hex(speed, 4) + hex(Math.abs(targetPosition), 8);
  }

  public async driveMotorToPosition(
    motorA: SpeedAndPosition,
    motorB: SpeedAndPosition = { speed: 0, position: 0 },
    motorC: SpeedAndPosition = { speed: 0, position: 0 },
    motorD: SpeedAndPosition = { speed: 0, position: 0 }
  ): Promise<void> {
    await this.ready;

    const message = `T303${this.writeSpeedAndPositionToMessage(
      motorA
    )}${this.writeSpeedAndPositionToMessage(
      motorB
    )}${this.writeSpeedAndPositionToMessage(
      motorC
    )}${this.writeSpeedAndPositionToMessage(motorD)}W`;

    const ret: Promise<void> = new Promise((resolve) => {
      this.addListener("T027300W", () => resolve());
    });

    await sendMessage(this.characteristic, message);

    return ret;
  }

  public async resetMotorPosition(...motor: Motor[]) {
    await this.ready;

    return Promise.all(
      motor.map((m) =>
        sendMessage(this.characteristic, `T028${bitmask(m, 2)}W`)
      )
    );
  }

  public async getCurrentPosition(motor: Motor): Promise<number> {
    await this.ready;

    const motorAPrefix = `T0A7A${hex(motor, 1)}`;
    const ret: Promise<number> = new Promise((resolve) => {
      this.addListener(motorAPrefix, (message) => {
        const position = Math.round(
          Number.parseInt(message.substring(6), 16) / STEP_FACTOR
        );
        resolve(position);
      });
    });

    await sendMessage(this.characteristic, `T02A${bitmask(motor, 2)}W`);

    return ret;
  }
}
