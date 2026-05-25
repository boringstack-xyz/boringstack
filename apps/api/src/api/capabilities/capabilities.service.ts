import type { ICapabilities } from "./capabilities.types";
import { buildCapabilities } from "./capabilities.utils";

export class CapabilitiesService {
  get(): ICapabilities {
    return buildCapabilities();
  }
}

export const capabilitiesService = new CapabilitiesService();
