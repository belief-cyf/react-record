import InlineWorker from 'inline-worker'

export class Recorder {
  config = {
    bufferLen: 4096,
    numChannels: 1,
    mimeType: 'audio/wav'
  }

  recording = false

  callbacks = {
    getBuffer: [],
    exportWAV: []
  }

  constructor (source, cfg) {
    Object.assign(this.config, cfg)
    this.context = source.context
    this.node = (this.context.createScriptProcessor ||
    this.context.createJavaScriptNode).call(this.context,
      this.config.bufferLen, this.config.numChannels, this.config.numChannels)

    this.node.onaudioprocess = (e) => {
      if (!this.recording) return

      var buffer = []
      for (var channel = 0; channel < this.config.numChannels; channel++) {
        buffer.push(e.inputBuffer.getChannelData(channel))
      }
      this.worker.postMessage({
        command: 'record',
        buffer: buffer
      })
    }

    source.connect(this.node)
    this.node.connect(this.context.destination)    //this should not be necessary

    let self = {}
    this.worker = new InlineWorker(function () {
      let recLength = 0,
        recBuffers = [],
        sampleRate,
        numChannels

      this.onmessage = function (e) {
        switch (e.data.command) {
          case 'init':
            init(e.data.config)
            break
          case 'record':
            record(e.data.buffer)
            break
          case 'exportWAV':
            exportWAV(e.data.type)
            break
          case 'getBuffer':
            getBuffer()
            break
          case 'clear':
            clear()
            break
        }
      }

      function init (config) {
        sampleRate = config.sampleRate
        numChannels = config.numChannels
        initBuffers()
      }

      function record (inputBuffer) {
        for (var channel = 0; channel < numChannels; channel++) {
          recBuffers[channel].push(inputBuffer[channel])
        }
        recLength += inputBuffer[0].length
      }

      function exportWAV (type) {
        var bufferL = mergeBuffers(recBuffers[0], recLength)
        var interleaved = interleave(bufferL)
        let dataview = encodeWAV(interleaved)
        let audioBlob = new Blob([dataview], {type: type})

        this.postMessage({command: 'exportWAV', data: audioBlob})
      }

      function getBuffer () {
        let buffers = []
        for (let channel = 0; channel < numChannels; channel++) {
          buffers.push(mergeBuffers(recBuffers[channel], recLength))
        }
        this.postMessage({command: 'getBuffer', data: buffers})
      }

      function clear () {
        recLength = 0
        recBuffers = []
        initBuffers()
      }

      function initBuffers () {
        for (let channel = 0; channel < numChannels; channel++) {
          recBuffers[channel] = []
        }
      }

      function mergeBuffers (recBuffers, recLength) {
        let result = new Float32Array(recLength)
        let offset = 0
        for (let i = 0; i < recBuffers.length; i++) {
          result.set(recBuffers[i], offset)
          offset += recBuffers[i].length
        }
        return result
      }

      function interleave (inputL) {
        // let length = inputL.length + inputR.length;
        var compression = 44100 / 11025    //计算压缩率
        var length = inputL.length / compression
        let result = new Float32Array(length)

        let index = 0,
          inputIndex = 0

        while (index < length) {
          result[index++] = inputL[inputIndex]
          inputIndex += compression//每次都跳过3个数据
          inputIndex++
        }
        return result
      }

      function floatTo8BitPCM (output, offset, input) {
        for (var i = 0; i < input.length; i++, offset++) {    //这里只能加1了
          var s = Math.max(-1, Math.min(1, input[i]))
          var val = s < 0 ? s * 0x8000 : s * 0x7FFF
          val = parseInt(255 / (65535 / (val + 32768)))     //这里有一个转换的代码,这个是我个人猜测的,就是按比例转换
          output.setInt8(offset, val, true)
        }
      }

      function floatTo16BitPCM (output, offset, input) {
        for (var i = 0; i < input.length; i++, offset += 2) {   //因为是int16所以占2个字节,所以偏移量是+2
          var s = Math.max(-1, Math.min(1, input[i]))
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
        }
      }

      function writeString (view, offset, string) {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }

      function encodeWAV (samples) {
        var sampleBits = 8//16;//这里改成8位
        var dataLength = samples.length * (sampleBits / 8)
        let buffer = new ArrayBuffer(44 + dataLength)
        let view = new DataView(buffer)

        var sampleRateTmp = 11025//sampleRate;//写入新的采样率
        var sampleBits = 8
        var channelCount = 1
        var offset = 0
        /* 资源交换文件标识符 */
        writeString(view, offset, 'RIFF')
        offset += 4
        /* 下个地址开始到文件尾总字节数,即文件大小-8 */
        view.setUint32(offset, /*32*/ 36 + dataLength, true)
        offset += 4
        /* WAV文件标志 */
        writeString(view, offset, 'WAVE')
        offset += 4
        /* 波形格式标志 */
        writeString(view, offset, 'fmt ')
        offset += 4
        /* 过滤字节,一般为 0x10 = 16 */
        view.setUint32(offset, 16, true)
        offset += 4
        /* 格式类别 (PCM形式采样数据) */
        view.setUint16(offset, 1, true)
        offset += 2
        /* 通道数 */
        view.setUint16(offset, channelCount, true)
        offset += 2
        /* 采样率,每秒样本数,表示每个通道的播放速度 */
        view.setUint32(offset, sampleRateTmp, true)
        offset += 4
        /* 波形数据传输率 (每秒平均字节数) 通道数×每秒数据位数×每样本数据位/8 */
        view.setUint32(offset, sampleRateTmp * channelCount * (sampleBits / 8), true)
        offset += 4
        /* 快数据调整数 采样一次占用字节数 通道数×每样本的数据位数/8 */
        view.setUint16(offset, channelCount * (sampleBits / 8), true)
        offset += 2
        /* 每样本数据位数 */
        view.setUint16(offset, sampleBits, true)
        offset += 2
        /* 数据标识符 */
        writeString(view, offset, 'data')
        offset += 4
        /* 采样数据总数,即数据总大小-44 */
        view.setUint32(offset, dataLength, true)
        offset += 4
        /* 采样数据 */
        floatTo8BitPCM(view, 44, samples)

        return view
      }
    }, self)

    this.worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: this.config.numChannels
      }
    })

    this.worker.onmessage = (e) => {
      let cb = this.callbacks[e.data.command].pop()
      if (typeof cb == 'function') {
        cb(e.data.data)
      }
    }
  }

  record () {
    this.recording = true
  }

  stop () {
    this.recording = false
  }

  clear () {
    this.worker.postMessage({command: 'clear'})
  }

  getBuffer (cb) {
    cb = cb || this.config.callback
    if (!cb) throw new Error('Callback not set')

    this.callbacks.getBuffer.push(cb)

    this.worker.postMessage({command: 'getBuffer'})
  }

  exportWAV (cb, mimeType) {
    mimeType = mimeType || this.config.mimeType
    cb = cb || this.config.callback
    if (!cb) throw new Error('Callback not set')

    this.callbacks.exportWAV.push(cb)

    this.worker.postMessage({
      command: 'exportWAV',
      type: mimeType
    })
  }

  static
  forceDownload (blob, filename) {
    let url = (window.URL || window.webkitURL).createObjectURL(blob)
    let link = window.document.createElement('a')
    link.href = url
    link.download = filename || 'output.wav'
    let click = document.createEvent('Event')
    click.initEvent('click', true, true)
    link.dispatchEvent(click)
  }
}

export default Recorder
