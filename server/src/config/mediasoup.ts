// mediasoup worker and router configuration
// Designed for scalability: each worker handles CPU-bound tasks
// multiple workers can run on multi-core machines

export const config = {
  // Worker settings
  // numWorkers: number of CPU cores to use for mediasoup workers
  // Each worker runs in its own thread
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: 'warn' as const,
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
    ] as string[],
  },

  // Router media codecs
  // We support VP8/VP9 for video (good simulcast support) and Opus for audio
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as const,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },

  // WebRTC transport settings
  // These affect how many concurrent connections each worker can handle
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: '127.0.0.1',
      },
    ],
    initialAvailableOutgoingBitrate: 1_000_000,
    minimumAvailableOutgoingBitrate: 600_000,
    maxSctpMessageSize: 262_144,
    maxIncomingBitrate: 1_500_000,
  },

  // Producer settings for simulcast
  // Simulcast: producer sends multiple resolutions, consumer picks appropriate one
  producer: {
    simulcast: true,
    simulcastProfiles: [
      { scaleResolutionDownBy: 4, maxBitrate: 150_000 },   // Low (QVGA)
      { scaleResolutionDownBy: 2, maxBitrate: 500_000 },   // Medium (VGA)
      { scaleResolutionDownBy: 1, maxBitrate: 1_500_000 }, // High (HD)
    ],
    // Active speaker detection interval
    // We use audio levels from RTP to detect who's speaking
    audioLevelIntervalMs: 200,
    audioLevelThreshold: -50,
  },
}
