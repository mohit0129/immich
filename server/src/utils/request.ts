import { IncomingHttpHeaders } from 'node:http';
import { UAParser } from 'ua-parser-js';

export const fromChecksum = (checksum: string): Buffer => {
  return Buffer.from(checksum, checksum.length === 28 ? 'base64' : 'hex');
};

export const fromMaybeArray = <T>(param: T | T[]) => (Array.isArray(param) ? param[0] : param);

export const getAppVersionFromUA = (ua: string) =>
  ua.match(/^immich-(?:android|ios|unknown)\/(?<appVersion>.+)$/)?.groups?.appVersion ??
  // legacy format
  ua.match(/^Immich_(?:Android|iOS|Unknown)_(?<appVersion>.+)$/)?.groups?.appVersion ??
  null;

export const getUserAgentDetails = (headers: IncomingHttpHeaders, clientIp?: string) => {
  const uaString = (headers['user-agent'] as string) ?? '';
  const userAgent = UAParser(uaString);
  const appVersion = getAppVersionFromUA(uaString);

  const rawIp =
    (fromMaybeArray(headers['x-forwarded-for'])?.split(',')[0]?.trim()) ||
    (fromMaybeArray(headers['x-real-ip'])?.trim()) ||
    (fromMaybeArray(headers['cf-connecting-ip'])?.trim()) ||
    clientIp ||
    '';

  const cleanIp = rawIp.replace(/^::ffff:/, '');

  let location = '';
  if (cleanIp) {
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
      location = 'Localhost (127.0.0.1)';
    } else if (
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
    ) {
      location = `Local Network (${cleanIp})`;
    } else {
      location = cleanIp;
    }
  }

  const headerBrand = (headers['x-device-brand'] as string)?.trim();
  const headerModel = ((headers['x-device-model'] as string) || (headers['devicemodel'] as string))?.trim();
  const headerName = (headers['x-device-name'] as string)?.trim();
  const headerOS = ((headers['x-device-os'] as string) || (headers['devicetype'] as string))?.trim();

  const vendor = userAgent.device.vendor || headerBrand || '';
  const model = userAgent.device.model || headerModel || headerName || '';
  const browserName = userAgent.browser.name || '';
  const browserMajor = userAgent.browser.version ? userAgent.browser.version.split('.')[0] : '';
  const browser = browserName ? `${browserName}${browserMajor ? ' ' + browserMajor : ''}` : '';

  let deviceType = '';
  if (vendor && model) {
    deviceType = model.toLowerCase().startsWith(vendor.toLowerCase()) ? model : `${vendor} ${model}`;
  } else if (model) {
    deviceType = model;
  } else if (vendor) {
    deviceType = `${vendor} Device`;
  } else if (browser) {
    deviceType = browser;
  } else if (userAgent.device.type) {
    deviceType = userAgent.device.type.charAt(0).toUpperCase() + userAgent.device.type.slice(1);
  } else if (headerName) {
    deviceType = headerName;
  } else {
    deviceType = 'Unknown Device';
  }

  const osName = userAgent.os.name || headerOS || '';
  const osVersion = userAgent.os.version ? userAgent.os.version.split('.')[0] : '';
  let deviceOS = osName;
  if (osName && osVersion && !osName.includes(osVersion)) {
    deviceOS = `${osName} ${osVersion}`;
  }
  if (!deviceOS) {
    deviceOS = 'Unknown OS';
  }

  if (location) {
    deviceOS = `${deviceOS} • ${location}`;
  }

  return {
    deviceType,
    deviceOS,
    appVersion,
  };
};
