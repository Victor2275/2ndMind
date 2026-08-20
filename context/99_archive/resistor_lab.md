# **Characterizing Linear and Non-Linear Circuit Elements: I-V Relationships in Resistors and LEDs**

Physics 4BL, Spring 2026, April 10  
Lab Section 6, Table 4

**Ethan Chang, Victor Gusev, Savanah Elias**  
---

# **1\. Abstract**

This experiment investigated the relationship between voltage, current, and resistance by testing Ohm’s Law and examining non-linear circuit elements. Using an ESP32 microcontroller and a potentiometer-controlled circuit, voltage measurements were collected across a 1 kΩ resistor and several colored LEDs. These measurements were then used to calculate current and create current–voltage (IV) curves for each circuit element tested.

For the resistor, the IV curve showed a linear relationship between current and voltage, resulting in an experimental resistance of approximately 1050 Ω, which is consistent with the expected value. In contrast, the LEDs showed non-linear behavior, with each color having a different minimum voltage before current began to increase significantly.

Overall, the results support Ohm’s Law for resistors and show LED’s semiconductor properties made apparent from voltages differing in significant values.

# **2\. Introduction**

This report will explain the relationship between voltage, resistance, and current and give a relative idea how one might test expected values. Understanding the relationship between voltage, current, and resistance is fundamental to the study of electrical circuits and modern electronics.  Current refers to the amount of charge that flows per unit time, measured in Amps for our purposes. Voltage is the force that pushes those charges, electrons, and is measured in Volts. Resistance is property of materials defined by their ability to oppose the flow of electric current, with the units of ohms. The overall equation that exemplifies linearity within the relationship given to us by Ohm's Law: Voltage \= Current \* Resistance (Serway 575). However, not all circuit elements obey this linear behavior, particularly semiconductor devices such as light-emitting diodes (LEDs).

Now when looking more closely at the actual experiment we are seeing how voltages differ when read from a 1 kΩ resistor and then versus 3 different colored LEDs and calculating current using an ESP32 microcontroller-based setup. The ESP32 measures only voltage, so we use a known resistor to determine current through the circuit. Some of the LEDs appear to glow brighter than others when attached to the breadboard when the original resistor was and as the potentiometer that was also attached was adjusted from zero to its max, the values then recorded to produce IV curves. These observations can be explained by the presence of differing band gaps for each LED. The band gap is the space between the valence band and the conduction band for a material where electrons do not freely exist, they must either stay in the valence band or move through the band gap to make it to the conduction band. In order for those electrons to travel between the bands they require a certain amount of energy, in this case given by the voltage provided in the circuit. The LEDs that did not glow as bright revealed a larger band gap not as easily overcome, leading to the characteristic non-linear IV curve observed in LEDs.

The goal of this experiment is to verify Ohm’s Law for a resistive element and to compare this behavioral result with components of non-linear results. We hypothesize that the resistor will give a linear IV graph with a constant resistance, while the LEDs will display non-linear behavior with distinct voltage thresholds that vary by color.

# **3\. Methods**

## **3.1 Experimental Setup**

The experimental setup for this lab consisted of an ESP32 microcontroller, a breadboard circuit, a multimeter, a waveform generator, and an oscilloscope. Of these items, the ESP32 was used to record analog voltage data through its analogRead function while the multimeter was used to generate calibration data points for later analysis. The base circuit used in this experiment included two 1 kΩ resistors connected in series with data being taken from a position along the circuit between the voltage controller and first fixed 1 kΩ resistor via a connection to the ESP32’s input pin. Initially, a potentiometer was used to vary the voltage source by sweeping four passes through the full range of input voltages. For diode resistance characterization, the second resistor of the setup was replaced by a red, green, and then blue LED and the potentiometer sweeping procedure was implemented once again (Figure 1). 

![][image1]  
Figure 1\. Potentiometer Test Circuit Diagram

However, in later trials, the potentiometer was replaced by a waveform generator producing ramping waves so as to minimize the human error associated with turning the potentiometer’s knob by hand as well as create a consistently varying input voltages (Figure 2).

![][image2]  
Figure 2\. Waveform Generator Test Circuit Diagram

## **3.2 Voltage Calibration Procedure**

A two point calibration was used to convert raw ESP32 integer data to voltage values. To do this, the potentiometer was first set to a lower voltage setting where it would return an integer reading of approximately 1000\. Using the multimeter, the actual voltage corresponding to this value was recorded. Similarly, the second calibration point was taken in the same manner but at a higher integer reading of approximately 3000\. Once both calibration values and their corresponding actual voltages were obtained, equation (1) was used to calculate the calibration slope while equation (2) was used to find the linear offset. 

m \= (V2Real \- V1Real) / (V2ESP \- V1ESP)                                                 (1)

b \= V2Real \- ( m \* V2ESP )                                                          (2)

Using these values, the uncertainty of the slope and offset were also found by equation (3) and (4) respectively.

δm \= m√((δV1 / (V1 \+ V2)2) \+  (δV2 / (V1 \+ V2)2))                                    (3)

δb \= √ (( δV )2 \+ ( VESP \* δm )2)                                                 (4)

 Combined, these values resulted in a linear conversion that was applied to all subsequent data sets to convert integer readings to voltage values. 

## **3.3 Data Collection**

Data collection for this experiment was conducted using two main voltage controller configurations. In the first configuration, the potentiometer was slowly swept across its full range from minimum to maximum to minimum resistance four times to ensure enough data could be collected to establish a relationship. Once these values were recorded via the ESP32’s serial monitor, they were exported as CSV files for analysis in Jupyter Notebook. In total, four data sets were collected in this manner with the second resistor slot being replaced by a resistor, a red LED, a green LED, and finally a blue LED.

In the second configuration, the potentiometer was replaced with a waveform generator which was programmed to output a ramping wave with a 5 V peak to peak amplitude, 2.5 V DC offset, and 0.1 Hz frequency. These settings were chosen so as to produce slow, smooth waves that varied consistently over time. Before connecting the waveform generator to the main circuit setup, the output signal was first verified using an oscilloscope by directly connecting it to the generator via a double ended BNC cable. Once the waveform was verified, it was connected to the circuit using a BNC to alligator clip cable. Data was then collected for the same circuits tested in the potentiometer setup (resistor, red LED, green LED, and blue LED). 

## **3.4 Data Processing and Analysis**

All data analysis was performed in Jupyter Notebook using Python and its NumPy and Matplotlib libraries. Once CSV files were imported and the raw data was converted into voltage values via equation (5), the current through the circuit was calculated using Ohm’s law (6) by applying the measured voltage across the known 1 kΩ resistor. Because the two resistors were connected in series, the current was assumed to be identical throughout all components.

VReal \= m \* VESP \+ b                                                         (5)

I \= V / R                                                                (6)

Current to voltage curves were then created by plotting voltage on the x-axis and current on the y-axis. For the resistor trials, because of their linear nature, a linear regression was used via NumPy’s polyfit function to determine the slope of the IV relationship with the error being taken as the square root of the associated covariance matrix. The experimental resistance was thus calculated to be the inverse of this slope (7) with its error being calculated via equation (8). For the LED trials, IV curves were plotted, but a linear regression was not used as, while there are internal resistors, LEDs do not obey Ohm’s Law. As such, the scatter plots were used to determine the forward voltage.

R \= 1 / m                                                                 (7)

δR \= δm / m2                                                             (8)

Additionally, the forward voltage values for each LED were compared to their corresponding wavelengths whose values were obtained via standard LED wavelength ranges. A plot of wavelength to forward voltage was then generated to examine the relationship between these two values. All analysis was applied across each data set.

# **4\. Analysis, Results, and Discussion**

## **4.1.1 Calculations (Resistor)**

To calculate the results of the resistors, a scatter plot of the data was created, with the current on the Y axis and voltage difference on the X axis (calculated using the process described in 3.4). An upper bound and lower bound was also created on the data in order to account for sensor limitations (i.e max voltage readable by the ESP32). From the graph, a line of best fit was created using Numpy’s polyfit command, as well as generating a covalence matrix to find the resistance error. The resistance was then calculated by finding the slope of the line of best fit and taking the inverse. Error was found using err=rr2, where sigma r was determined by taking the first element in the covalence matrix and square rooting it. These calculations were identical for both data produced by the potentiometer and the waveform generator.

##  **4.1.2 Results and Graphs (Resistor)**

When taking the resistance of the resistor using the potentiometer, the resistance was calculated to be 1051.4 ± 2.4 Ohms, and the waveform generator data gave us a resistance of 1035.5 ± 1.21 Ohms. The graphs are shown below (Figure 3).  
![][image3]![][image4]  
Figure 3\. IV Curve for Resistors via Potentiometer and Wave Form Generators

##  **4.1.3 Discussion (Resistor)**

Both of these resistance values are similar to what we can expect, as the resistors that were tested across were 1000 Ohms ± 1% resistors, so both of our data values are slightly above the range. We also assumed the “known” resistance of the first resistor was 1000 Ohms, which could be different in reality The 2 datasets give different values, which makes sense as the data was taken on 2 different days and 2 different resistors were used (both were 1000 ohm resistors, but their errors may be different). However, to reduce the uncertainty we could potentially use more accurate resistors that match better, or use the same resistor for both sets of data. We could also gather more data points for the conversion stated in 3.4, rather than using only 2 datapoints for the conversion (or rather getting the voltage right away from a voltmeter rather than the values the ESP32 gives).

## **4.2.1 Calculations (LEDs)**

To calculate the results of the LEDs, a scatter plot of the data was created, with the current on the Y axis and voltage difference on the X axis (calculated using the process described in 3.4). An upper bound and lower bound was also created on the data in order to account for sensor limitations (i.e max voltage readable by the ESP32). From the graph, a line of best fit was created using Numpy’s polyfit command. The resistance was then calculated by finding the slope of the line of best fit and taking the inverse. The forward voltage was calculated by finding the first voltage that produced a non-zero current. The forward voltages were used to plot another graph with the forward voltages and wavelengths. These calculations were identical for both data produced by the potentiometer and the waveform generator.

##  **4.2.2 Results and Graphs (LEDs)**

Each Forward voltage and Resistance is listed with each graph, where P represents the potentiometer data and WFG represents the Wave Form Generator data (Figure 5).  
![][image5]![][image6]  
![][image7]![][image8]  
![][image9]![][image10]![][image11]![][image12]  
Figure 5\. Red, Green, and Blue IV curves and their forward voltage to wavelength plots for potentiometer and waveform generator

##  **4.2.3 Discussion (LEDs)**

The curves follow a sort of “s” shaped curve, which makes sense as these LEDs are not resistors, but instead diodes. This means that the resistance values don’t make much sense, as it isn’t a resistor. However, for both the potentiometer and wave form generator, we see the forward voltage increases in the order red, green, blue. This can also be seen in the wavelength vs voltage graph, which shows as wavelength increases, forward voltage decreases. This graph is not very fitted, most likely because there are only 3 data points and not exact wavelengths. To improve this experiment in the future, it would be beneficial to measure the wavelength of the light for the wavelength vs forward voltage, as well as get more datapoints (i.e more LEDs).

# **5\. Conclusion**

Within reasonable uncertainty, the results of this experiment ultimately confirm the initial hypothesis that the 1 kΩ resistor would exhibit a linear current-voltage graph and that the LEDs would demonstrate a non linear behavior with an inverse relationship between the forward voltage and wavelength. 

For the resistor, while both measurements demonstrated strongly linear natures consistent with Ohm’s law, the experimentally derived resistance values of 1051.4 ± 2.4 Ω from the potentiometer as well as 1035.5 ± 1.21 Ω from the waveform generator both fall slightly outside of the manufacturer’s listed resistance values of 1000 ± 10 Ω. This discrepancy suggests that the experimental setup may have introduced additional error via factors such as imperfect wires and an imprecise calibration. 

In contrast, the LED IV curves showed clear non linearity after reaching a threshold voltage. Additionally, the analysis of the relationship between LED forward voltage and wavelength demonstrated an inverse relationship between forward voltage and wavelength such that smaller wavelengths possess higher forward voltages and larger wavelengths possess lower forward voltages. Overall, this trend is consistent with the theoretical relationship as the minimum energy required to raise an electron to a higher energy state will increase as the wavelength shortens. 

Despite the data’s overall general agreement with theory, several sources of error were present in the experimental setup. Namely, the two point calibration method may have introduced some error in both slope and offset which could have propagated into all voltage and current calculations. Additionally, other sources of uncertainty may have included imperfect factors such as non ideal copper wires, noisy data, and human error in the potentiometer trials. 

In the future, data acquisition and analysis may be made more precise through the implementation of a multiple point calibration instead of a two point fit as was used in this experiment. Additionally, the resistance of each component could be tested experimentally using a more precise multimeter such that resistance calculations align more closely to theoretical models. Additionally, more in depth modeling and analysis of the LED IV curves could establish a more certain relationship between forward voltage and wavelength.

Overall, despite some unaccounted for sources of error within the experimental setup, the data resulting from this lab suggests validity of Ohm’s Law for resistors as well as the theoretical behaviors for LEDs.  

# **6\. References**

Serway, Raymond A., et al. “Motion in One Direction.” Physics for Scientists and Engineers, Cengage Brooks/Cole, 2014\`

# **7\. Appendix**

[image1]: ../assets/labs/resistor_lab_image1.png

[image2]: ../assets/labs/resistor_lab_image2.png

[image3]: ../assets/labs/resistor_lab_image3.png

[image4]: ../assets/labs/resistor_lab_image4.png

[image5]: ../assets/labs/resistor_lab_image5.png

[image6]: ../assets/labs/resistor_lab_image6.png

[image7]: ../assets/labs/resistor_lab_image7.png

[image8]: ../assets/labs/resistor_lab_image8.png

[image9]: ../assets/labs/resistor_lab_image9.png

[image10]: ../assets/labs/resistor_lab_image10.png

[image11]: ../assets/labs/resistor_lab_image11.png

[image12]: ../assets/labs/resistor_lab_image12.png