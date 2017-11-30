/*
 * 录音组件
 */
import React, {Component} from 'react';
import {Button} from 'antd';
import { PropTypes } from 'prop-types';
import Recorder from '../lib/recorder';
import CSSModules from 'react-css-modules';
import styles from './RecorderComponent.scss';

class RecorderComponent extends Component {
    constructor (props) {
        super(props);
        this.state = {
            err: false,             // 调用录音功能时抛出的错误信息
            microphoneState: 1,          // 初始化进入时麦克风的状态 1为默认准备录音状态 2为正在录音的状态 3为录音结束状态 4为正在播放状态 5为暂停播放状态
            recorderTime: 0,             // 录音计时
            playRecorderTime: 0,           // 播放录音计时
            recorderCountdown: this.props.recorderCountdown + 1,             // 用于显示录音倒计时 可根据需要调整  例如从10开始倒计时则设置为11
            blobFile: null              // 录音文件
        };
        this.recorder = null;
        this.audio_context = null;
        this.playRecording = this.playRecording.bind(this);
        this.pauseRecorder = this.pauseRecorder.bind(this);
        this.recorderAgain = this.recorderAgain.bind(this);
        this.exportAudioFile = this.exportAudioFile.bind(this);
    }
    timeSetInterval
    timePauseSetInterval

    static defaultProps = {
        getAudioFile: (file, recorderTime) => { console.log('录音文件:', file) },                      // 录音结束的回调
        maxTime: 5,                                       // 允许最长录音时间  单位分钟
        recorderCountdown: 10,                              // 录音结束倒计时从几秒开始
        showRecorderCountdown: true
    }

    // 初始化录音功能
    componentDidMount () {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        window.URL = window.URL || window.webkitURL;
        const that = this;
        this.audio_context = new AudioContext();
        navigator.getUserMedia({audio: true}, (stream) => {
            var input = that.audio_context.createMediaStreamSource(stream);
            that.recorder = new Recorder(input);
        }, function (e) {
            console.log('录音出错!：');
            console.log(e)
            switch (e.name) {
            case 'DevicesNotFoundError':
                that.setState({
                    err: '没有找到录音设备,请插入录音设备后刷新页面重试'
                });
                break;
            case 'NotFoundError':
                that.setState({
                    err: '没有找到录音设备,请插入录音设备后刷新页面重试'
                });
                break;
            case 'NotAllowedError':
                that.setState({
                    err: '请允许网站使用录音设备后刷新页面重试'
                });
                break;
            case 'PermissionDeniedError':
                that.setState({
                    err: '请允许网站使用录音设备后刷新页面重试'
                });
                break;
            default:
                that.setState({
                    err: '无法打开麦克风，异常信息:' + e.name
                });
                break;
            };
        });
    }

    // 离开页面时清除计时器
    componentWillUnmount () {
        window.clearInterval(this.timeSetInterval);
        window.clearInterval(this.timePauseSetInterval);
    }

    // 格式化计时
    handleFormattingTime (time) {
        let theTime = parseInt(time);
        let theTime1 = 0;// 分
        let result;
        if (theTime >= 60) {
            theTime1 = parseInt(theTime / 60);
            theTime = parseInt(theTime % 60);
        }
        if (theTime < 10 && theTime1 === 0) {
            result = ' 00 : 0' + parseInt(theTime);
        } else if (theTime < 10) {
            result = ' 0' + parseInt(theTime);
        } else if (theTime1 === 0 && theTime >= 10) {
            result = ' 00 : ' + parseInt(theTime);
        } else {
            result = '' + parseInt(theTime);
        }
        if (theTime1 > 0 && theTime1 < 10) {
            result = '0' + parseInt(theTime1) + ' : ' + result;
        }
        return result;
    }

    // 开始录音
    startRecording = () => {
        if (this.state.err) {
            alert(this.state.err);
        } else {
            this.setState({
                microphoneState: 2
            }, () => {
                this.recorder && this.recorder.record();
                this.timeSetInterval = setInterval(() => {
                    this.setState({
                        recorderTime: this.state.recorderTime + 1
                    }, () => {
                        if (this.state.recorderTime >= (this.props.maxTime * 60)) {
                            this.setState({
                                recorderCountdown: this.state.recorderCountdown - 1
                            }, () => {
                                if (this.state.recorderCountdown === 0) {
                                    window.clearInterval(this.timeSetInterval);
                                    this.stopRecording()
                                }
                            })
                        }
                    });
                }, 1000);
            })
        }
    }

    // 结束录音
    stopRecording = () => {
        this.setState({
            microphoneState: 3
        }, () => {
            window.clearInterval(this.timeSetInterval);
            this.recorder && this.recorder.stop();
            this.createAudio();
            this.recorder.clear();
        })
    }

    // 外部获取录音文件   父组件通过ref获取当本组件 然后调用该方法获取到文件已供上传
    exportAudioFile () {
        return {
            file: this.state.blobFile,
            recorderTime: this.state.recorderTime
        };
    }

    // 创建隐藏的audio接收录音 提供播放功能
    createAudio = () => {
        let that = this;
        this.recorder && this.recorder.exportWAV(function (blob) {
            console.log('录音文件大小：', blob.size / 1024 / 1024);
            console.log(blob)
            that.setState({
                blobFile: blob
            }, () => {
                that.props.getAudioFile(that.state.blobFile, that.state.recorderTime);
            });
            document.getElementById('recordingslist').innerHTML = '';     // 清空上次录音
            var url = URL.createObjectURL(blob);
            var li = document.createElement('li');
            var au = document.createElement('audio');
            au.id = 'audio';
            au.addEventListener('ended', () => {              // 监听播放结束事件
                that.setState({
                    microphoneState: 3
                });
                window.clearInterval(that.timePauseSetInterval);    // 播放结束后结束播放计时
            });
            au.controls = true;
            au.src = url;
            li.appendChild(au);
            document.getElementById('recordingslist').appendChild(li);
        });
    }

    // 播放录音
    playRecording () {
        this.setState({
            playRecorderTime: this.state.recorderTime
        }, () => {
            let audio = document.getElementById('audio');
            audio.play();
            this.timePauseSetInterval = setInterval(() => {
                if (this.state.playRecorderTime > 0) {
                    this.setState({
                        playRecorderTime: this.state.playRecorderTime - 1
                    });
                }
            }, 1000)
            this.setState({
                microphoneState: 4
            });
        })
    }

    // 暂停录音
    pauseRecorder () {
        let audio = document.getElementById('audio');
        audio.pause();
        window.clearInterval(this.timePauseSetInterval);
        this.setState({
            microphoneState: 5
        });
    }

    // 重新录制
    recorderAgain () {
        window.clearInterval(this.timeSetInterval);
        window.clearInterval(this.timePauseSetInterval);
        this.setState({
            microphoneState: 1,
            recorderTime: 0,
            playRecorderTime: 0,
            recorderCountdown: this.props.recorderCountdown,
            blobFile: null
        }, () => {
            this.props.getAudioFile(this.state.blobFile)
        })
    }

    render () {
        return (
            <div className='recorder' styleName='recorder'>
                <div id='recordingslist' style={{display: 'none'}} />
                <div className='recorder-box'>
                    {
                        this.state.microphoneState === 1 &&
                        <div className='microphone-box' onClick={this.startRecording}>
                            <i className='iconfont icon-luyin2' />
                        </div>
                    }
                    {
                        this.state.microphoneState === 2 &&
                        <div className='microphone-box' onClick={this.stopRecording}>
                            <i className='iconfont icon-luyinzanting' />
                            <div className='corrugated' />
                            <div className='corrugated' style={{ animationDelay: '0.9s' }} />
                        </div>
                    }
                    {
                        (this.state.microphoneState === 5 || this.state.microphoneState === 3) &&
                        <div className='microphone-box' onClick={this.playRecording}>
                            <i className='iconfont icon-luyinzanting1' />
                        </div>
                    }
                    {
                        this.state.microphoneState === 4 &&
                        <div className='microphone-box' onClick={this.pauseRecorder}>
                            <i className='iconfont icon-luyinzanting' />
                            <div className='corrugated' />
                            <div className='corrugated' style={{ animationDelay: '0.9s' }} />
                        </div>
                    }
                    <span className='recorder-text'>
                        {
                            this.state.microphoneState === 1 && `最长可录音${this.props.maxTime}分钟`
                        }
                        {
                            (this.state.microphoneState === 2 || this.state.microphoneState === 3) && this.handleFormattingTime(this.state.recorderTime)
                        }
                        {
                            this.props.showRecorderCountdown && this.state.recorderCountdown < (this.props.recorderCountdown + 1) && this.state.recorderCountdown > 0 && <span className='recorder-countdown'>录音结束倒计时{this.state.recorderCountdown}</span>
                        }
                        {
                            (this.state.microphoneState === 4 || this.state.microphoneState === 5) && this.handleFormattingTime(this.state.playRecorderTime)
                        }
                        {
                            (this.state.microphoneState === 3 || this.state.microphoneState === 5) && <Button className='recorder-again-btn' onClick={this.recorderAgain}>重录</Button>
                        }
                    </span>
                </div>
            </div>
        )
    }
}

RecorderComponent.propTypes = {
    getAudioFile: PropTypes.func,
    maxTime: PropTypes.number,
    recorderCountdown: PropTypes.number,
    showRecorderCountdown: PropsTypes.bool
}
export default CSSModules(RecorderComponent, styles);
