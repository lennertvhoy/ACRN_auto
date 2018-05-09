import './App.css';

import React, {Component} from 'react';
import * as constants from './constants';

import Slider from 'rc-slider';
import Tooltip from 'rc-tooltip';
import 'rc-slider/assets/index.css';

import {Button, ToggleButton, ToggleButtonGroup} from 'react-bootstrap';

import Tone from 'tone';
import StartAudioContext from 'startaudiocontext';

class App extends Component {
    constructor(props, context) {
        super(props, context);


        // use local storage for volume and frequency
        let localVolume = this.getLocalStorageInt(constants.VOLUME_KEY, constants.DEFAULT_VOLUME);
        let localFreq = this.getLocalStorageInt(constants.FREQ_KEY, constants.DEFAULT_FREQ);
        let playerState = this.getLocalStorageInt(constants.PLAYER_STATE_KEY, constants.PLAYER_STATES.PLAY_TONE);

        let buttonText = constants.PLAY_TONE_TEXT;
        if (playerState === constants.PLAYER_STATES.PLAY_ACRN) {
            buttonText = constants.PLAY_SEQ_TEXT;
        }

        // generate initial sequence
        let newFreqs = this.generateSequence(localFreq);

        // setup initial state
        this.state = {
            freq: localFreq,
            freqSeq: newFreqs,
            volume: localVolume,
            playState: playerState,
            enableSlider: true,
            isPlaying: false,
            userStarted: false,
            playButtonText: buttonText,
            restCount: 0,
            synth: new Tone.MonoSynth({
                "volume": 0.05,
                "oscillator": {
                    "type": "sine"
                },
                "envelope": {
                    "attack": 0.08,
                    "decay": 0.12,
                    "sustain": 0.25,
                    "release": 0.2,
                }
            }).toMaster(),
            osc: new Tone.Oscillator({
                "frequency": constants.DEFAULT_FREQ
            }).toMaster()
        }
    }

    getLocalStorageInt = (localKey, defaultValue) => {
        let localValue = localStorage.getItem(localKey);
        if (localValue === null) {
            return defaultValue
        } else {
            return parseInt(localValue, 10);
        }
    }


    componentDidMount = () => {
        //set the bpm and initialize sound context
        Tone.Transport.bpm.value = 90 * 4;
        Tone.context.latencyHint = 'interactive';
        StartAudioContext(Tone.context, '.App');
        // make sure volume is off initially
        Tone.Master.volume.rampTo(-Infinity, 0.05);
    };

    handleTextFreqChange = (e) => {
        let value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            this.handleFreqChange(value);
        }
    };

    handleFreqChange = value => {
        let {osc} = this.state;
        osc.frequency.value = value;
        let newFreqs = this.generateSequence(value);

        this.setState({
            freq: value,
            freqSeq: newFreqs,
        });

        localStorage.setItem(constants.FREQ_KEY, value);
    };


    handleClickPlay = () => {
        let {isPlaying, volume, playState} = this.state;
        if (!isPlaying) {
            Tone.Master.volume.rampTo(volume, 0.05);
        } else {
            Tone.Master.volume.rampTo(-Infinity, 0.05);
        }
        this.updatePlayState(!isPlaying, playState);
        this.setState({isPlaying: !isPlaying});
    };

    playAcrn = () => {
        let {restCount, synth, freqSeq, freq} = this.state;
        let newSequence = new Tone.Sequence((time, frequencies) => {
            synth.triggerAttackRelease(frequencies, "4n", "+0.1");
            if (frequencies === 0) {
                restCount++;
                if (restCount === 4) {
                    let newFreqs = this.generateSequence(freq);
                    this.setState({
                        freqSeq: newFreqs,
                        restCount: 0
                    });
                    Tone.Transport.stop();
                    this.playAcrn();
                }
            }
        }, freqSeq);
        this.setState({sequence: newSequence});
        newSequence.start(0);
        newSequence.set({loop: false});
        Tone.Transport.start("+0.1");
    }

    updatePlayState = (isPlaying, playState) => {
        let {osc} = this.state;
        if (isPlaying) {
            switch (playState) {
                case constants.PLAYER_STATES.PLAY_ACRN:
                    this.setState({playButtonText: constants.STOP_SEQ_TEXT,
                    enableSlider: false});
                    this.playAcrn();
                    break;
                case constants.PLAYER_STATES.PLAY_TONE:
                    this.setState({playButtonText: constants.STOP_TONE_TEXT});
                    osc.start();
                    break;
                default:
                    break;

            }
        } else {
            switch (playState) {
                case constants.PLAYER_STATES.PLAY_ACRN:
                    this.setState({playButtonText: constants.PLAY_SEQ_TEXT});
                    let {sequence} = this.state;
                    sequence.cancel();
                    sequence.dispose();
                    Tone.Transport.stop();
                    this.setState({enableSlider: true});

                    break;
                case constants.PLAYER_STATES.PLAY_TONE:
                    this.setState({playButtonText: constants.PLAY_TONE_TEXT});
                    osc.stop();
                    break;
                default:
                    break;
            }
        }
    };

    generateFreqs = (currentFreq) => {
        return [Math.floor(currentFreq * 0.773 - 44.5), Math.floor(currentFreq * 0.903 - 21.5),
            Math.floor(currentFreq * 1.09 + 52), Math.floor(currentFreq * 1.395 + 26.5)];
    };

    generateSequence = (currentFreq) => {
        let freqSeq = [];

        let freqMap = this.generateFreqs(currentFreq);

        for (let i = 0; i < 4; i++) {
            let s = this.shuffle(freqMap.slice());
            freqSeq.push(...s);
        }
        freqSeq.push(...[0, 0, 0, 0]);
        return freqSeq;
    };

    shuffle = (a) => {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    handleRadioChange = (newPlayState) => {
        let {isPlaying, playState} = this.state;
        let buttonText = null;
        let enableSlider = true;

        if (isPlaying) {
            // stop the sound
            this.updatePlayState(false, playState)
        }

        switch (newPlayState) {
            case constants.PLAYER_STATES.PLAY_ACRN:
                if (isPlaying) {
                    enableSlider = false;
                    buttonText = constants.STOP_SEQ_TEXT;
                } else {
                    buttonText = constants.PLAY_SEQ_TEXT;
                }
                break;
            case constants.PLAYER_STATES.PLAY_TONE:
                if (isPlaying) {
                    buttonText = constants.STOP_TONE_TEXT;
                } else {
                    buttonText = constants.PLAY_TONE_TEXT;
                }
                break;
            default:
                break;

        }

        this.setState({
            playState: newPlayState,
            enableSlider: enableSlider,
            playButtonText: buttonText
        });

        if (isPlaying) {
            // start the new sound
            this.updatePlayState(true, newPlayState);
        }
        localStorage.setItem(constants.PLAYER_STATE_KEY, newPlayState);
    };

    handleVolumeChange = (event) => {
        let volume = event - 0.05;
        Tone.Master.volume.rampTo(volume, 0.05);
        this.setState({volume: volume});
        localStorage.setItem(constants.VOLUME_KEY, volume);
    };

    freqSliderTooltip = (props) => {
        const {dragging, index, ...restProps} = props;
        const {freq} = this.state;
        const Handle = Slider.Handle;
        return (
            <Tooltip
                prefixCls="rc-slider-tooltip"
                overlay={freq}
                visible={dragging}
                placement="top"
                key={index}
            >
                <Handle value={freq} {...restProps} />
            </Tooltip>
        );
    };


    render = () => {
        let {freq, enableSlider, volume, playButtonText, playState} = this.state;
        return (
            <div className="App">
                <nav className="navbar navbar-default">
                    <div className="container">
                        <div className="navbar-header navbar-right">
                            <ul className="nav navbar-nav">
                                <li><a href="http://github.com/generalfuzz/acrn-react">Source</a></li>
                                <li><a href="http://generalfuzz.net/contact.php">Contact</a></li>
                                <li><a href="http://www.generalfuzz.net">Music</a></li>

                            </ul>
                        </div>
                    </div>
                </nav>
                <div className="container ">
                    <div className="jumbotron bg-info">
                        <h1 className="App-title">ACRN Tinnitus Protocol</h1>
                    </div>
                    <p>This is my attempt at implementing the <a
                        href="http://www.tinnitus.org.uk/acoustic-cr-neuromodulation">Acoustic Coordinated Reset
                        Neuromodulation</a> tinnitus treatment protocol
                        using <a
                            href="http://www.thetinnitusclinic.co.uk/downloads/Tass%20et%20al_RNN%202012_Counteracting%20Tinnitus%20by%20Acoustic%20CR%20Neuromodulation.pdf">this
                            paper</a> as a guide.</p>
                    <div className="instructions">
                        <ul>
                            <li>First start the tone "Play Tone" button.</li>
                            <li>Adjust the frequency slider until it matches your tinnitus tone. You can also type in
                                the frequency if you know it already.
                            </li>
                            <li>Adjust the volume until it is a little bit louder than your tinnitus tone.</li>
                            <li>Switch from "Tone" to "Sequence" mode</li>
                        </ul>
                    </div>
                    <p>Inspired by <a
                        href="http://www.tinnitustalk.com/threads/acoustic-cr%C2%AE-neuromodulation-do-it-yourself-guide.1469/">this</a> thread on <a href="http://www.tinnitustalk.com">tinnitustalk.com</a> and <a
                            href="http://www.reddit.com/r/tinnitus/comments/15x99f/recent_tinnitus_study_and_my_attempt_at_utilizing/">this</a> reddit thread.</p>
                    <br/>
                    <div>
                        <ToggleButtonGroup type="radio" name="options"
                                           defaultValue={playState}
                                           onChange={this.handleRadioChange}>
                            <ToggleButton value={constants.PLAYER_STATES.PLAY_TONE}>Tone</ToggleButton>
                            <ToggleButton value={constants.PLAYER_STATES.PLAY_ACRN}>Sequence</ToggleButton>
                        </ToggleButtonGroup>
                        <br/>
                        <br/>
                        <div className='slider'>
                            Frequency
                            <Slider
                                min={constants.MIN_FREQ}
                                max={constants.MAX_FREQ}
                                value={freq}
                                onChange={this.handleFreqChange}
                                handle={this.freqSliderTooltip}
                                disabled={!enableSlider}
                            />
                        </div>
                        <div>
                            <input className='freq-value' onChange={this.handleTextFreqChange} value={freq}/>
                        </div>
                        <br/>
                        <p>
                            <Button className='btn-success btn-lg'
                                    onClick={this.handleClickPlay}>{playButtonText}</Button>
                        </p>
                        <div className='slider volume'>
                            Volume
                            <Slider
                                min={-80}
                                max={0}
                                value={volume}
                                onChange={this.handleVolumeChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
