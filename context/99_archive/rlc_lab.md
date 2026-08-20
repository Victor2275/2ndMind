# **Lab Report 3: Measured RLC Circuit Behaviors via ESP32**

Physics 4BL, Spring 2026, May 1  
Lab Section 6, Table 4

**Ethan Chang, Victor Gusev**  
---

# **1\. Abstract**

This experiment investigated the time dependent and frequency dependent behavior of RC and RLC circuits using an ESP32 based data acquisition system as an alternative to an oscilloscope. For RC circuits, voltage responses to square wave inputs were recorded and analyzed through exponential curve fitting to extract time constants. The measured time constants showed moderate agreement with theoretical predictions, with percent errors ranging from approximately 16% to 32%, primarily due to component tolerances, discretized sampling, and limitations in voltage resolution.

For the RLC system, underdamped responses were analyzed by isolating oscillatory ringing following square wave transitions. While oscillatory behavior consistent with theory was observed, the discrete nature of the ESP32 sampling system limited resolution of the decay envelope, reducing fitting accuracy for damping parameters. In addition, frequency response measurements were performed using sinusoidal sweeps across multiple resistance configurations. The resulting resonance curves followed a Lorentzian profile and allowed for extraction of resonant frequency and quality factor values. Overall, the errors of the Q Factors examined ranged from 26.05% to 4.91% which ultimately demonstrated improved agreement with theoretical predictions as resistance increased.

Overall, the RC and resonance experiments demonstrated qualitative and partial quantitative agreement with theoretical models of exponential charging and frequency response in RLC systems. However, the underdamped analysis demonstrated significant experimental limitations in imaging rapid oscillations and decay behavior due to resolution constraints and non ideal circuit components. 

# **2\. Introduction**

In this study, the time dependent and frequency dependent behaviors of RC and RLC circuits are experimentally examined through an ESP32 data acquisition setup. Understanding how circuits respond to changing voltages over time is foundational to modern electronics and possesses a wide range of applications including signal processing, filtering, and oscillatory systems. In this context, voltage represents the driving force applied to the circuit while resistance, capacitance, and inductance determine how the system stores and dissipates that energy.

For a resistor capacitor (RC) circuit, the relationship between voltage and time can be modeled by Kirchhoff’s Loop Rule (Serway 843\) which, when simplified, results in an exponential function (1) 

V(t)=V0(1-e-t/)                                                  (1)

where the time constant () is given by the net resistance multiplied by the capacitance (Serway 849\) (2).

\=RC                                                             (2)

This time constant determines how quickly the capacitor charges or discharges with larger resistance or capacitance values resulting in slower responses. However, when an inductor is introduced to form a resistor, inductor, and capacitor (RLC) circuit, the system begins to show behavior similar to a damped harmonic oscillator and can be modeled by equation 3

d2xdt2+2dxdt+02x=0                                                    (3)

where the damping factor and natural frequency of the oscillator are given by equations 4 and 5 respectively (Serway 981).

\=R2L                                                                (4)

0=1LC                                                              (5)

More specifically, in the underdamped case, the system oscillates with an exponentially decaying amplitude which can be modeled by equation 6 (Serway 985).

V(t)=V0e-tcos(dt+)                                               (6)

This demonstrates the continuous exchange of energy between the capacitor and inductor while resistance dissipates energy over time. Such oscillatory responses are essential in understanding real world systems such as electrical filters.

In addition to its oscillatory behavior, RLC circuits also exhibit resonance when driven by an external source. At the resonance frequency, the inductive and capacitive reactances cancel resulting in a spike in the circuit’s response. The sharpness of this resonance is thus represented by the quality factor (7).

Q=0LR                                                               (7)

Experimentally, this creates a peak in the power response that follows a Lorentzian distribution allowing for key factors such as the natural frequency and damping to be extracted through curve fitting. Hence, the goal of this experiment is to verify the theoretical models describing exponential charging, damped oscillations, and resonance in electrical circuits. It is expected that the RC circuits will exhibit exponential behavior consistent with their calculated time constants while the RLC circuit will demonstrate underdamped oscillations and resonance curves that follow theoretical predictions with some deviation due to non ideal components and sensor limitations.

# **3\. Methods**

### **3.1 RC Charging Curves**

An ESP32 microcontroller was used as a voltage sensing and recording device to approximate oscilloscope functionality. Due to device variability and limited resolution, the system was first calibrated using a waveform generator. A 100 Hz sine wave with a peak to peak voltage of 1.250 V and a DC offset of 1.650 V was applied directly to the ESP32’s pin 36\. Voltage data were recorded using SerialPlot in the ASCII format with a 115200 baud rate and the true sampling frequency was determined through analysis in Jupyter Notebook.

Following calibration, three RC circuits were constructed with the schematic depicted in Figure 1 using measured component values. 

![][image1]

Figure 1\. Wiring diagram of RC circuit for experimental setup (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 3, 2026\)

The resistor and capacitor combinations tested can also be seen in Table 1 below.

| 3.1 Component Configurations |  |  |  |
| ----- | :---- | :---- | :---- |
|  | Resistor | Capacitor | Internal Resistance |
| Configuration 1 | 10 μF | 10 kΩ | 50 Ω |
| Configuration 2 | 47 μF | 1 kΩ | 50 Ω |
| Configuration 3 | 100 μF | 220 Ω | 50 Ω |

Table 1\. Configurations of resistors and capacitors used in each RC trial.

The total resistance in each circuit included the 50 Ω internal resistance of the waveform generator. Resistance and capacitance values were verified using a digital multimeter prior to data collection.

A square wave input with 1.250 Vpp and 1.650 V offset was next applied to each setup with a period equal to ten times the largest calculated time constant to ensure full charging and discharging cycles. Voltage data were recorded for each circuit and finally exported for analysis in Jupyter Notebook.

In Jupyter Notebook, raw voltage data were plotted against sample index and a single charging interval was isolated. The data were trimmed, the DC offset was removed by subtracting the minimum value, and the peaks were normalized to a maximum value of 1\. The time axis was reconstructed using the calibrated sampling frequency. Each data set was then fitted to an exponential charging model using a least squares method. Finally, theoretical curves based on measured component values were also generated and overlaid for comparison.

### **3.2 RLC Underdamped Response**

For the RLC analysis, the ESP32 was reconfigured for a higher sampling speed (approximately 500 kHz). As such, a secondary calibration was applied using a 1 kHz sine wave with 1.250 Vpp and 1.650 V offset. The sampling frequency was determined using the same procedure as in Part 3A.

Next, as seen in Figure 2, an RLC circuit was constructed using a 10 mH inductor, 0.1 μF capacitor, and the resistance stemming from the waveform generator’s internal resistance plus the inductor’s resistance. Again, all actual component values were measured prior to experimentation using a multimeter. A 100 Hz square wave with 1.250 Vpp and 1.650 V offset was then applied to induce oscillations. Voltage data were recorded over several ringing cycles with the three clearest being used for later analysis.

![][image2]

Figure 2\. Wiring diagram of RLC circuit for underdamped experimental setup (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 3, 2026\)

Data processing involved isolating a single oscillation beginning at a peak. The data set was trimmed, DC offset removed by subtracting the steady state value, and normalized using the initial peak voltage. Time values were reconstructed from the sampling frequency.

The processed data were fit to an underdamped oscillation model using a least squares method. Theoretical curves were generated using measured component values and total resistance and then compared to experimental fits. 

### **3.3 RLC Resonance and Q-Factor**

To analyze resonance behavior, a similar set of RLC circuits were driven by a sinusoidal input in frequency sweep mode. The waveform generator was configured to produce a sine wave with 500 mV peak to peak voltage and a 1.650 V DC offset. The frequency was swept linearly from 1 Hz to 10 kHz over a 20 second interval.

In total, three resistance conditions were tested as seen in figure 3\. The first relied on only the internal resistance. The second added a 220 Ω resistor in series to the original and the third added an additional 220 Ω. Voltage data were recorded using the ESP32 during each frequency sweep and exported to Jupyter Notebook for analysis.

![][image3]

Figure 3\. Wiring diagram of RLC circuit for resonance experimental setup (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 3, 2026\)

During analysis, a single complete frequency sweep was isolated from the data set. The DC offset was removed by subtracting the mean value and the voltage data were squared to obtain a quantity proportional to power. A corresponding frequency array was generated using a linear spacing from 1 Hz to 10 kHz.

Each data set was plotted as power versus frequency and fit to a Lorentzian function using a least squares method. Fit parameters included the resonance frequency and bandwidth. Theoretical resonance curves were generated for each resistance condition and compared to experimental results.

# **4\. Analysis, Results, and Discussion**

## **4.1.1 Calculations (RC Changing Circuits)**

To calculate the time constant  from an RC circuit, the raw data is taken and placed into a graph. The data set (as seen in Figure 4\) will have multiple peaks, and one of the peaks is taken for data. The x axis is cut to only show one increase in charge, which is the data to be analyzed. The data is then normalized (set the y axis to go from 0 to 1). Then, the time axis is determined by taking the baud rate of 115200 bits per second, dividing it by 36 bits per input, and then taking the inverse to get the seconds per input. This value is then multiplied by the x axis, giving the time in seconds on said axis. Then, using the data and the expected value of tau, the rc\_exponential function creates a line of best fit of the data and generates an expected tau value. This value is then compared to the real value of tau. This is repeated for all 3 datasets.

![][image4]  
Figure 4\. Raw data showing inputs on the x axis and voltage intensity on the y axis.

##  **4.1.2 Results and Graphs (RC Changing Circuits)**

When calculating the voltage over time and tau constants. The values calculated are listed below (Figure 5).  
![][image5] ![][image6]  
![][image7]![][image8]![][image9]

Figure 5\. Plots of all the experimental data, each showing the Theoretical tau and the experimentally determined tau values. The last image shows all of the errors for each dataset.

## **4.1.3 Discussion (RC Changing Circuits)**

While there was error in all of the experiments, the graph fittings look similar. We can see the errors were 28.55%, 16.04%, and 32.13% for experiments 1, 2, and 3 respectively. This could have been due to imperfect equipment, such as inaccurate resistor measurements or discrete, incorrect measurements from the oscilloscope, which can be improved by using better equipment.

## **4.2.1 Calculations (RLC Underdamped)**

Similar to 4.1.1, To compare the theoretical and experimental ringing, the raw data is taken and placed into a graph. The data set (as seen in Figure 4\) will have multiple peaks, and one of the peaks is taken for data. The x axis is cut to only show one increase in charge, which is the data to be analyzed. The data is then taken, and a fit of the data is created with the expected calculated ringing using the inductance and resistance. This graph is laid over the existing data, and compared.

## **4.2.2 Results and Graphs (RLC Underdamped)**

![][image10]![][image11]

Figure 6\. The first graph shows the data gathered, and the second graph shows the fitted graph to the datapoints from the dataset.

## **4.2.3 Discussion (RLC Underdamped)**

From the graph, it is shown that the raw data is that the values are somewhat similar to what is expected, however because of how discrete the data points are in the raw data the fitting is not perfect. This can be improved by switching the sampling technique, and using a device capable of faster data collection.

## **4.3.1 Calculations (RLC Resonance and Q-Factor)**

To calculate the RLC resonance and Q-factor, the raw data is taken and placed into a graph. The data set (as seen in Figure 7\) will have multiple sections, and one of the sections is taken for data. The x axis is cut to only show one section, which is the data to be analyzed. The data is then shifted down (set the y axis to the mean of the data). This data is then squared, giving us the power graph. Then, the data is normalized so the power value is between 0 and 1, generating the graph also seen in Figure 7\. Then, the data is fed into the Lorentzian function, generating a Lorentzian curve for the power function, as well as the theoretical Lorentzian function. This is repeated for all 3 datasets.

![][image12]![][image13]  
Figure 7 The first graph shows the normalized power vs frequency graph, while the second graph shows a snapshot of the raw data used for analysis

## **4.3.2 Results and Graphs (RLC Resonance and Q-Factor)**

The Lorentzian and the errors for each curve are shown below in Figure 8\.

![][image14]![][image15]![][image16]

Figure 8\. Respective Power and Frequency Graphs for each resistance with an inductance of 9.7 \* 10\*\*-3 Henry and capacitance of 0.107 \* 10\*\*-6 Farad.

## **4.3.3 Discussion (RLC Resonance and Q-Factor)**

Looking at the graphs in Figure 8, the measured fit is closely related to the actual fit of the curve. However, there was some error in each graph, as shown in Figure 8\. This was likely due to how the data was collected, with discrete values and imperfect equipment, similar to the reasoning in 4.1.3.

# **5\. Conclusion**

While the results of the first experiment show errors greater than 15%, we can see the approximate shape and size are similar to what we can expect to the theoretically perfect value. This shows this experiment can be used to roughly determine the constant tau. This sentiment is shared in the second and third experiments, where the shape is approximately what we would expect, and the values of the third experiment in terms of error are also more precise. However, for the second experiment, we can see there is some deviation due to the “overexertion” of the ESP-32, taking data in snapshots in an attempt to view a faster frequency.

For the RC Changing Circuits, the relationship between voltage and time was observed to be exponential and consistent with theory. The tau values listed are shown to be 0.0718 ± 3.81 \* 10\-4, 0.0573 ± 7.54 \* 10\-4, and 0.0357 ± 5.11 \* 10\-4 seconds for each graph respectively, which results in a 28.55%, 16.04%, and 32.13% margin of error respectively from their expected values of tau. These issues derive from imperfect, discrete measurements from the oscilloscope, as well as imperfect components such as resistors. 

In the RLC Underdamped portion of the experiment, we noticed the expected “ringing” in the data, however because of the very discrete way of taking data, we did not match the data perfectly. However, the general shape was similar. In the future for more accurate data, better data measuring tools should be used.

For the RLC Resonance and Q-Factor analysis, the graphs very closely match the expected data, with errors for each Q Factor of 26.05%, 7.26%, and 4.91% for each experiment respectively. We also can see a pattern where as the data resistance increased, the uncertainty also decreased. This is most likely due to the resistors being more accurate than the internal resistance of the inductor and oscilloscope, and as a result as the resistors contributed more the error decreased. As stated in the previous parts, better equipment would result in more accurate measurements, as well as more samples per cycle.

Overall, despite several sources of uncertainty and disagreement between the derived and actual values in the experiments, the experimental results are mostly consistent with theoretical predictions of the behavior of various laws such as Kirchoff’s loop rule, in terms of shape and approximate magnitude. This shows that various circuit components and behaviors can be approximated by creating specific circuits and inputting a specific voltage or voltage patterns.

# **6\. References**

Serway, Raymond A., et al. “Motion in One Direction.” Physics for Scientists and Engineers, Cengage Brooks/Cole, 2014\`

# **7\. Appendix**

[image1]: ../assets/labs/rlc_lab_image1.png

[image2]: ../assets/labs/rlc_lab_image2.png

[image3]: ../assets/labs/rlc_lab_image3.png

[image4]: ../assets/labs/rlc_lab_image4.png

[image5]: ../assets/labs/rlc_lab_image5.png

[image6]: ../assets/labs/rlc_lab_image6.png

[image7]: ../assets/labs/rlc_lab_image7.png

[image8]: ../assets/labs/rlc_lab_image8.png

[image9]: ../assets/labs/rlc_lab_image9.png

[image10]: ../assets/labs/rlc_lab_image10.png

[image11]: ../assets/labs/rlc_lab_image11.png

[image12]: ../assets/labs/rlc_lab_image12.png

[image13]: ../assets/labs/rlc_lab_image13.png

[image14]: ../assets/labs/rlc_lab_image14.png

[image15]: ../assets/labs/rlc_lab_image15.png

[image16]: ../assets/labs/rlc_lab_image16.png