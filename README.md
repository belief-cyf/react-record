# react-record-component
a react record component
---
```
import React, {Component} from 'react';
import RecorderComponent from 'RecorderComponent';

<RecorderComponent getAudioFile={(audioFile, recorderTime) => this.getAudioFile(audioFile, recorderTime)} />

```

组件属性：

| 属性           | 说明           | 类型  | 默认值  |
| ------------   |:-------------:| -----:| -----:  |
| getAudioFile        | 停止录音后的回调 | func     | (file, recorderTime)=>{} |
| maxTime   | 最长允许录音时常（分钟）        |  number    | 5  |
| showRecorderCountdown   | 是否显示录音结束倒计时 | bool     | true  |
| recorderCountdown   | 录音结束倒计时从多少秒开始 | number     | 10  |
