(() => {
  "use strict";

  const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];

  class MediaRecorderService {
    constructor(options = {}) {
      this.options = {minDurationMs: 800, silenceThreshold: 0.018, ...options};
      this.stream = null;
      this.recorder = null;
      this.chunks = [];
      this.startedAt = 0;
      this.audioContext = null;
      this.analyser = null;
      this.levelFrame = null;
      this.levelListeners = new Set();
      this.lastLevel = 0;
    }

    static supported() {
      return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    }

    static chooseMimeType() {
      if (!window.MediaRecorder) return "";
      return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported?.(type)) || "";
    }

    async requestMicrophone() {
      if (!MediaRecorderService.supported()) throw new Error("Trình duyệt không hỗ trợ ghi âm microphone.");
      if (this.stream?.active) return this.stream;
      this.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      await this.startLevelMeter();
      return this.stream;
    }

    async startLevelMeter() {
      if (!this.stream || this.audioContext) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      source.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) { const normalized = (value - 128) / 128; sum += normalized * normalized; }
        this.lastLevel = Math.min(1, Math.sqrt(sum / data.length) * 4);
        this.levelListeners.forEach(listener => listener(this.lastLevel));
        this.levelFrame = requestAnimationFrame(tick);
      };
      tick();
    }

    onLevel(listener) {
      this.levelListeners.add(listener);
      listener(this.lastLevel);
      return () => this.levelListeners.delete(listener);
    }

    async start() {
      await this.requestMicrophone();
      if (this.recorder?.state === "recording") throw new Error("Recording đang chạy.");
      this.chunks = [];
      const mimeType = MediaRecorderService.chooseMimeType();
      const options = mimeType ? {mimeType} : undefined;
      try { this.recorder = new MediaRecorder(this.stream, options); }
      catch { this.recorder = new MediaRecorder(this.stream); }
      this.startedAt = performance.now();
      return new Promise((resolve, reject) => {
        this.recorder.ondataavailable = event => { if (event.data?.size) this.chunks.push(event.data); };
        this.recorder.onerror = event => reject(event.error || new Error("Không thể ghi âm."));
        this.recorder.onstart = () => resolve({mimeType:this.recorder.mimeType || mimeType || "audio/webm"});
        this.recorder.start(250);
      });
    }

    async stop() {
      if (!this.recorder || this.recorder.state !== "recording") throw new Error("Không có recording đang chạy.");
      return new Promise((resolve, reject) => {
        const recorder = this.recorder;
        recorder.onerror = event => reject(event.error || new Error("Không thể kết thúc recording."));
        recorder.onstop = () => {
          const durationMs = Math.max(0, performance.now() - this.startedAt);
          const mimeType = recorder.mimeType || MediaRecorderService.chooseMimeType() || "audio/webm";
          const blob = new Blob(this.chunks, {type:mimeType});
          const empty = blob.size < 256 || durationMs < this.options.minDurationMs;
          resolve({
            blob,
            mime_type:mimeType,
            duration_seconds:Number((durationMs / 1000).toFixed(2)),
            size_bytes:blob.size,
            created_at:new Date().toISOString(),
            empty,
            warning:empty ? "Recording quá ngắn hoặc không có dữ liệu." : null
          });
        };
        recorder.stop();
      });
    }

    stopTracks() {
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.recorder = null;
      if (this.levelFrame) cancelAnimationFrame(this.levelFrame);
      this.levelFrame = null;
      this.analyser = null;
      if (this.audioContext) this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.lastLevel = 0;
      this.levelListeners.forEach(listener => listener(0));
    }
  }

  window.AptisMediaRecorderService = MediaRecorderService;
})();
