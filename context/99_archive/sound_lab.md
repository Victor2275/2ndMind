# **Lab Report 2: Sound Waves and Fourier Transforms**

Physics 4BL, Spring 2026, April 21  
Lab Section 6, Table 4

**Ethan Chang, Victor Gusev, Savanah Elias**  
---

# **1. Abstract**

In this paper we will explore the physics of sound, specifically its speed in air and analyzing complex sound signals. Sound can generate such a signal because of longitudinal pressure waves, more simply put as vibrations through some medium. The relationships we will see and use for this experiment says that speed is equal to the wavelength times the frequency of a wave, v=fλ. In the first part of the experiment, the speed of sound was determined by measuring the phase shift between a signal emitted by a speaker and the signal detected by a microphone at varying distances. Recognizing positions where the signals were in and out of phase was how the wavelength was determined and used to calculate the speed of sound. In the second part, Fourier transform techniques were used to analyze recorded sound waves. The results confirm speculated relationships between wave properties as well as support speed dependence on frequency and wavelength. The experimentally determined speed of sound was found to be 359 m/s, which is consistent with the accepted value within experimental uncertainty.

# **2. Introduction**

Sound is a mechanical, longitudinal pressure wave that propagates through a medium via oscillations of particles. The properties of a medium in which our sound waves are traveling across are also very important to observe. The temperature, density, viscosity and state of matter are all medium properties that can affect the speed of soundwaves. In air at room temperature, the speed of sound is approximately 343 m/s.   
Frequencies, mentioned earlier in our fundamental equation, are understood as an inverse to time, measured in Hertz which is just one over a second. One method of measuring wavelength involves analyzing the phase difference between two signals. When two individual waves are present whether they are in sync or out of sync, better known as being in phase versus out of phase. In phase causes constructive interference which is when the waves build on each other and create a more amplified single wave. Whereas out of phase waves cause destructive interference which will ultimately do the opposite and either make a less amplified single wave or if they are perfectly out of phase, by pi or half a wavelength, the result will be a straight horizontal line along the x-axis. This is all important to know because when a sound wave travels from a speaker to a microphone, the detected signal can be compared to the original electrical signal driving the speaker. As the distance between the speaker and microphone changes, the phase difference between these signals varies. By measuring these positions, the wavelength can be determined, allowing us to calculate the speed of sound.  
Besides simple sinusoidal waves, real-world sounds are often complex and fourier transforms help us understand. They are a mapping between domains and is how we get from a time domain to a much easier to work with frequency domain, because it will be consistent with one shape. On a related note, period functions help us with our data by giving us predictable intervals. The one component is the wavelength which can be measured on the x-axis from peak to peak or trough to trough along the function. The amplitude is characterized by the maximum and minimum y-axis values of the function. Frequency takes into account the number of cycles or oscillations per unit of time, otherwise known as the inverse of the period itself. One of the most basic waves we will see is the standing wave, whose amplitude is position dependent and oscillates in time.   
The purpose of this experiment is to measure the speed of sound using phase shift techniques and to analyze complex sound signals using Fourier transforms. Interesting enough all these ideas will bring us to be able to determine the material of an unknown medium using the frequency to calculate sound speed. Certain materials will allow sound to travel at a certain speed and this is how we will know.

# **3. Methods**

## **3.1 Speed of Sound Measurement via Phase Shift**

## **3.1.1 Experimental Setup**

The experimental setup for this lab consisted of a waveform generator, speakers, microphone, oscilloscope, and a meter stick. Using a waveform generator, a sine wave signal with a frequency of 1 kHz, 1 V peak to peak amplitude, and 0 V DC offset was generated and transmitted to the speaker via a 3.5 mm audio connection (Figure 1). The same signal was simultaneously plugged into an oscilloscope to serve as a reference during data acquisition for determining regions of constructive and destructive interference.

![][image1]

Figure 1. Wiring diagram of microphone and speaker for experimental setup (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 2, 2026)

In the setup itself, the microphone was positioned facing the speaker pair to detect the emitted sound wave. Similar to the waveform generator, its output was also connected to the oscilloscope which overlaid the two signals for a direct comparison between the reference wave and the received sound wave. Additionally, the meter stick was placed along the axis between the speakers and microphone to measure displacement for speed of sound analysis (Figure 2).

![][image2]

Figure 2. Experimental setup for phase shift speed of sound experiment

### **3.1.2 Procedure**

To begin data acquisition, the speakers were first turned on to emit their 1 kHz sound wave. Once the wave was verified on the oscilloscope, the oscilloscope channels were adjusted to overlay the microphone signal onto the signal generated by the waveform generator. Following all initial adjustments, the microphone’s displacement in relation to the speakers was then physically adjusted until both signals were in phase (ɸ = 0). This position was recorded in a spreadsheet using the aforementioned meter stick and then the microphone was translated away from the speaker until the signals were completely out of phase (ɸ = π). Once again, the position was recorded and then the microphone was translated further in the same direction until the signals returned to being in phase (ɸ = 2π) where the position was recorded a final time.

This process was repeated a total of five times resulting in a total of 15 measurements with five data points per phase condition tested. 

### **3.1.3 Data Processing**

The collected distance measurements corresponding to each phase were averaged and their standard deviations were calculated to determine uncertainty. In addition, because each distance measurement carried an uncertainty due to the meter stick’s resolution, the total uncertainty for each phase was found by combining it with the standard deviation via equation 1.

σtotal = √(σstdl2 + σmeter2)                                                       (1)

Next, a phase vs. distance plot was then generated using NumPy’s weighted linear regression function with phase in radians on the x-axis and distance in centimeters on the y-axis. The weights for this fit were defined as the inverse of the total uncertainty for each phase measurement squared (2).

w = 1 / (σtotal2)                                                             (2)

To determine the experimental wavelength, the slope was multiplied by 2π (3).

λ = 2π * m                                                                (3)

Finally, to determine the uncertainty of the derived wavelength, the square root of the linear regression’s [0,0] position was taken.

### **3.1.4 Speed of Sound**

To determine the experimental speed of sound, the wavelength was multiplied by the frequency of the wave (4).

v = f * λ                                                                 (4)

To determine the uncertainty of this value, error propagation was used (5).

δv = v * √((δf / f)2 + (δλ / λ)2)                                               (5)

## **3.2 Fourier Analysis and Spectrogram of Sound Files**

### **3.2.1 Experimental Setup and Data Collection**

For this portion of the lab, sound recordings of piano chords were collected using an iPhone. Each recording consisted of individual notes played in ascending order, descending order, and then simultaneously as a chord (Figure 3). The recorded audio files were then converted into the .wav format and imported into Python for analysis.

![][image3]![][image4]

Figure 3. Key diagram used as reference for selecting experimental chords (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 2, 2026)

### **3.2.2 Data Processing and Analysis**

Using SciPy’s Fast Fourier Transform feature, a fast fourier transform was applied to the audio data to convert the signal from the time domain to the frequency domain. This allowed for identification of the primary frequencies of the file which corresponded to the musical notes played in the file.

Additionally, a spectrogram was generated to visualize how the frequency content of the signal evolved over time. 

## **3.3 Speed of Sound in a Solid Metal Rod**

A metal bar was excited by striking it while being held at a nodal point corresponding to the first harmonic (the center of the bar) resulting in antinodes forming on the ends of the rod (Figure 4).

![][image5]

Figure 4. Diagram of rod testing apparatus

The emitted sound frequency was recorded using the same fast fourier transform techniques described in the previous sections. Using the measured frequency and known harmonic relationships, the speed of sound in the material was calculated (6).

vrod = 2L * f                                                           (6)

This value was then compared to known speeds of sound in common metals to identify the material.

# **4. Analysis, Results, and Discussion**

## **4.1.1 Calculations (Speed of Sound)**

To calculate the speed of sound, the equation v=f, where v is the speed of sound,  is the wavelength, and f is the frequency. The frequency was set by the waveform generator to be 1000 Hz, and the wavelength is calculated by using the change of phase determined by the experiment. To find the wavelength, the average distance away from the speakers for in-phase,  out-of-phase, and back in-phase from 5 tests is taken, as well as the standard deviation for these 5 tests. A line of best fit is created from the averages and standard deviations using Python’s numpy module, and sigma m and b are calculated from said line of best fit by taking the square root of the covalence matrix indices [0,0] and [1,1] respectively. To get the wavelength, the slope is multiplied by 2. Then, the speed of sound is calculated using v=f. 

##  **4.1.2 Results and Graphs (Speed of Sound)**

When calculating the speed of sound. The values calculated are listed below (Figure 5).  
![][image6]

Figure 5. Phase vs Distance Speed of Sound Graph, with data analysis showing error

## **4.1.3 Discussion (Speed of Sound)**

The value from the experiment was off by roughly 5% from the expected speed of sound (359 vs 343 meters per second). This is somewhat expected due to the experimental conditions, namely noise from other sources. While conducting the experiment, there were several other groups performing the same experiment with similar wavelengths in close proximity, which the microphone may have picked up. The dataset was also imperfect, as to generate the dataset we “eyeballed” when the microphone was at certain phases. To adjust for this in the future, the experiment should be done in a quieter environment and should be taken with more precise equipment/different code in order to determine when the object was in/out of phase.

## **4.2.1 Calculations (Chords)**

To see the frequencies of the chords, a recording of the chord is taken and has a fourier transform applied to it. This resulting graph shows spikes in intensity at certain frequencies. We identify what frequency the spikes are at to determine the notes played.

##  **4.2.2 Results and Graphs (Chords)**

When calculating the frequencies of the chord, these graphs were generated. The frequencies calculated are listed below (Figure 6).  
![][image7]![][image8]![][image9]

Figure 6. Fourier transform of 3 different Chords, along with the major frequencies detected listed below.

## **4.2.3 Discussion (Chords)**

Looking at the frequencies we see that for the C major chord we have the main frequencies 261.5 Hz, 329.63 Hz, 393.6 Hz, 522.1 Hz, 659.0 Hz, and 784.6 Hz. The first 3 frequencies correspond to the notes C4, E4, and G4 respectively while the second 3 notes correspond to C5, E5, and G5, detecting the harmonic frequency of the C major scale. This is what we expect to see. We see similar phenomena in the A minor chord and D minor chords as seen with the values in (Figure 6). However, in the dataset there is still quite a bit of noise, so as stated in 4.1.3, this should be done in a quieter environment if the experiment is repeated.

## **4.3.1 Calculations (Pipe)**

To find the material of the pipe, first the frequency must be determined. To determine the frequency, we record the resonant frequency of the pipe, and use a Fourier transform to determine the frequency. After finding the frequency, we use the equation v=2fLn to find the speed of sound through the pipe. Because the pipe is fixed in the middle, The harmonic *n* is known to be an odd harmonic. The value *L* is also known to be 1.29 meters. After finding the speed of sound through the medium, we look up a chart and attempt to find a material similar to that of the pipe

![][image10]

## **4.3.2 Results and Graphs (Pipe)**

When calculating the frequencies of the pipe, these graphs were generated. The frequencies calculated are listed below (Figure 7).

Figure 7. Fourier Transform of the pipe noise.

## **4.3.3 Discussion (Pipe)**

Looking at the graph in Figure 7, there is a noise in the frequencies under 1000 Hz. If the region of interest is shrunk to frequencies between 2000 and 6000 Hz, we see several peaks, with the most defined peaks at 3485, 4950 Hz, and 5350 Hz. When looking at the table of speeds of sounds through different mediums in Fig, and testing different odd harmonics with the 2 frequencies listed, we get a speed of 4601 m/s when using the frequency 5350 Hz at the 3rd harmonic, which is close to the transverse speed of sound through Aluminum (5000 m/s). However, the value is still somewhat far off for a number of factors. Firstly, there was a significant amount of background noise, to the point where the background noise was louder than the resonance from the metal pipe. This likely added “fake” frequency peaks, where the frequency was not coming from the pipe but rather from another source (such as the nail hitting the pipe, or people talking in the background). Because of this, it was hard to determine which frequency peak to use. As stated in 4.2.3 and 4.1.3, this should have taken place in a significantly quieter environment, as the sound produced by the pipe was very quiet.

# **5. Conclusion**

While the results of the first experiment do not fall within an acceptable range of the accepted speed of sound, it does support the hypothesis that the speed of sound can be approximated using phase differences between a reference signal and a detected sound wave. Conversely, the results of the second experiment do support the use of Fourier analysis in decomposing sound signals into their constituent frequencies for the purposes of identifying composition.

For the phase shift method, the relationship between phase and distance was observed to be linear and consistent with theory. The weighted linear regression produced a slope of 5.7137 ± 0.1007 cm/rad and an intercept of 14.8076 ± 0.3970 cm. From this slope, the wavelength was determined to be 35.90 ± 0.63 cm which resulted in a final derived speed of sound of 359.00 ± 6.32 m/s.

The derived speed of sound falls slightly outside of two standard deviations of the accepted value of 343 m/s and has a 4.7% error margin. For this testing period, discrepancies likely arose primarily from external frequency interference, microphone positioning errors, and the limitations of manually aligning the signals displayed on the oscilloscope. However, other environmental factors, such as room reflections and temperature may have also influenced the final derived value resulting in disagreement between it and the accepted speed of sound.

In the Fourier analysis portion of the experiment, the FFT plots revealed the dominant frequencies corresponding to the played piano notes (A minor, C major, and D minor). The spectrogram further demonstrated how chords are simply composite sounds that can be separated back into their constituent note frequencies with insignificant inconsistencies arising from background noise.

For the solid material analysis, the experimentally determined speed of sound was 4601 m/s. This suggests that the rod was composed of aluminum as it falls within the expected range for aluminum (approximately 4-6 km/s). Remaining discrepancies may be attributed to imperfect boundary conditions when holding the rod at the nodal point, damping effects, noise, and uncertainty in frequency measurement.

Several sources of systematic and random error were present throughout the two labs. The primary systematic uncertainty for the first lab arose from manual phase alignment on the oscilloscope and impedance from other groups operating at slightly different frequencies. Additional sources included small inconsistencies in microphone positioning, noise in both electrical and acoustic signals, and the finite precision of the meter stick. In the second lab, error may have also arisen from outside sources of noise during the recording process as well as from fitting.

In future experiments, the precision of the experiment could be improved by using more automated phase detection methods, higher precision positioning equipment, and performing the experiment in a sound dampened environment to minimize other sources of noise. Additionally, increasing the number of measurements would further reduce statistical uncertainty and improve the reliability of the weighted regression.

Overall, despite several sources of uncertainty and disagreement between the derived and actual speed of sound, the experimental results are mostly consistent with theoretical predictions of sound wave behavior, support the use of phase differences as a method for approximating wavelength, and demonstrate how Fourier analysis can be used to decompose complex signals into their constituent frequencies for the purposes of identifying material makeup.

# **6. References**

Wikipedia contributors. (2025, March 22). *Speeds of sound of the elements*. Wikipedia. [https://en.wikipedia.org/wiki/Speeds_of_sound_of_the_elements](https://en.wikipedia.org/wiki/Speeds_of_sound_of_the_elements)

# 

# **7. Appendix**

[image1]: ../assets/labs/sound_lab_image1.png

[image2]: ../assets/labs/sound_lab_image2.png

[image3]: ../assets/labs/sound_lab_image3.png

[image4]: ../assets/labs/sound_lab_image4.png

[image5]: ../assets/labs/sound_lab_image5.png

[image6]: ../assets/labs/sound_lab_image6.png

[image7]: ../assets/labs/sound_lab_image7.png

[image8]: ../assets/labs/sound_lab_image8.png

[image9]: ../assets/labs/sound_lab_image9.png

[image10]: ../assets/labs/sound_lab_image10.png