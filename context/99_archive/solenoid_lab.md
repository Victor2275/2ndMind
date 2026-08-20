# **Lab Report 5: Verification of Magnetic Inductance Using Solenoid Bit Reader**

Physics 4BL, Spring 2026, June 5  
Lab Section 6, Table 4

**Ethan Chang, Victor Gusev**  
---

# **1\. Abstract**

This study examines the physical and mechanical principles of magnetic data storage by developing a macro scale analog of a hard disk drive reader. Using an experimental sensor composed of a 387 turn copper coil wrapped around a high permeability iron bolt core with a paperclip seeking tip, encoded binary bits in the form of magnets were decoded as they fell under uniform gravitational acceleration. While the initial design intended to decode magnetic domains based on polarity (N vs. S), hardware constraints of the ESP32 microcontroller's analog to digital converter (0V to 3.3V) constrained the project’s encoding to a presence based encoding system (Magnet \= 1, Empty Space \= 0). Signals were amplified using an LM358N operational amplifier set to increase the input signal by 20x.

A calibration matrix using a 11111 control string across three intervals (32 mm, 40 mm, and 48 mm) was used to map the shrinking time windows caused by gravitational acceleration and determined that the system's resolution limit was limited to 40 mm and above. Experimental testing of four distinct binary sequences (11011, 10110, 10101, and 10011\) implemented via a “starting 1” clock synchronization system successfully displayed reliable bit discrimination. While the collected data consistently deviated from idealized textbook theoretical curves due to experimental constraints such as geometric irregularities in the hand wound coil and non ideal rail friction, the use of several calibration sets allowed the system to completely overcome these physical variances. Ultimately, the system verified the scalability of Faraday’s Law of Induction and achieved 100% decoding accuracy across all experimental test samples.

# **2\. Introduction**

Understanding magnetic induction, the ability of a changing magnetic field to induce an electromotive force through a conductor, is integral to the function of a multitude of critical technologies that are foundational to the operation of human society. This ability to convert the physical movement of magnets to electrical power and vice versa has allowed for solar, hydroelectric, nuclear, wind, and gas power generation. By a similar strand, the conversion of such electricity back into physical movement has also allowed for the existence of electric motors which power a multitude of other modern technologies. Yet, besides these two widespread applications, there exists a third crucial use case of magnetic induction in the form of data storage and reading. 

Hard drives, floppy disks, magnetic tape cartridges, and the magnetic stripes found on automated credit cards all rely on the precise manipulation and configuration of microscopic magnetic domains. However, with this use case comes challenges related to converting a moving magnetic field into a reliable stream of binary digits.

While the underlying principles for such systems are highly scalable, translating them down to the microscopic scale adds increased complexity in the form of physical design and signal processing. These include signal attenuation, voltage rails clipping, resolution, and complexity related to variable reading speeds. As such, the goal of this study is to verify the underlying principles behind magnetic information storage using macro scale analog and apply kinematic and electromagnetic theory to design a reader system that can reliably decode a strip of passing magnetic bits. By modeling the acceleration of gravity and the strength of the changing magnetic field, we hypothesize that we will be able to establish a reliable time window baseline to accurately separate 1 bits (magnets) from 0 bits (empty space).

# **3\. Theoretical Background**

The operational physics of the macro scale analog data reader relies on the three main principles of Newtonian kinematics, Faraday's Law of Induction, and operational amplifier signal amplification.

## **3.1 Kinematics**

To eliminate as much human error as possible for the testing of the theoretical design, a drop track system was implemented such that the magnetized test strips would start at rest and fall freely under gravitational influence and induce the desired EMF in a seeking coil. Because the data strip falls freely under the uniform acceleration of gravity (g \= 9.81 m/s2) from a fixed release height (z0​), its position (z) and instantaneous velocity (v) change continuously as functions of time (t) and can be described using the standard kinematics equations shown below as equation 1 and equation 2 (Serway 21).

z(t)=z0+v0+12gt2                                                            (1)  
v(t)=v0+gt                                                                   (2)

Because velocity is increasing throughout the time window, the time interval spent over a fixed distance is expected to shrink over the course of the drop distance.

## **3.2 Faraday's Law, Induction, and Permeability**

The inductive reading head of the experimental design consists of a solenoid wound around a ferromagnetic core. Before interacting with any moving magnets, the physical ability of the core to channel magnetic fields via its self inductance (L) is dictated by its geometry and the magnetic permeability of the material as described below in equation 3 (Serway 713).

L=N2Al                                                                          (3)

Here, N \= 387 turns of wire and  l \= 4.10 cm is the core length, A is the cross sectional area, and μ is the absolute magnetic permeability of the core material. To maximize this property, a high permeability material (HDW 8.8 structural steel iron bolt) was selected. The absolute permeability of this bolt is defined by equation 4 (Serway 658).

\=0m                                                                          (4)

Where μ0 ​= 4π \* 10−7 T\*m/A is the permeability of free space, and κm​ is the high relative permeability of the iron bolt. In this system, the ferromagnetic bolt acts as a magnifier of flux by pulling scattered external flux lines directly through the center of the copper wire turns. To narrow the scanning window further, a steel paperclip was also fixed to the tip of the bolt to act as a seeking tip that focused the flux lines from a single precise point on the track in a manner similar to that of commercial hard drive heads.

When a permanent neodymium disc magnet passes this seeking tip, its moving external field cuts through the coil turns. According to Faraday's Law (Equation 5), this changing external magnetic flux (ΦB​) induces an electromotive force (E) (Serway 691).

E=-Ndmdt                                                              (5)

By utilizing the calculus chain rule, the generated electrical voltage can be derived in terms of the physical velocity (v(t)) of the falling track (Equation 6).

E=-Ndmdz\*dzdt=-N(dmdz\*v(t))                                          (6)

This mathematical relationship demonstrates that thex induced voltage is directly proportional to the velocity of the track. Hence, as the strip accelerates under gravity, the resulting EMF peaks will become taller, sharper, and narrower near the bottom of the drop.

## **3.3 Signal Processing**

The raw induced EMF (E) generated by this system is expected to lie in the millivolt range which is far below the detection threshold of a standard microcontroller. To resolve this issue, an LM358N operational amplifier was added to the breadboard between the bit reading device and the ESP32’s reading pin. The amplification through this system is simply given by a proportional ratio between the feedback and input resistances (Equation 7\) (Boyelstad 653).

Vout=-Vin(RfeedbackRinput)                                                        (7)

This configuration allowed the system to have a target voltage gain of approximately 20x ultimately scaling the millivolt induction signals up into a readable range.

The amplified analog voltage (Vout​) is then routed to an ESP32 microcontroller where an integrated analog to digital converter (ADC) converts the continuous signal into digital integer values spanning from 0 to 4095 over a 0V to 3.3V rail. The full setup is seen in Figure 1 below.

![][image1]

Figure 1\. Experimental induction seeker design

# **4\. Methodology**

## **4.1 Initial Design and Alterations**

The initial experimental design aimed to replicate traditional magnetic storage by alternating the poles of the permanent magnets along the track (North Pole \= 1, South Pole \= 0). On an oscilloscope, this setup yielded a full bipolar sine wave consisting of both positive and negative voltage peaks as predicted by literature.

However, this preliminary testing revealed a hardware related limitation. The ADC of the ESP32 is unipolar and thus cannot interpret or process negative voltages. As a result, any negative EMF produced by a South pole orientation or a departing magnet was nulled out to 0V and lost.

To circumvent this limitation without adding complex level shifting circuitry, the experimental design and encoding logic was altered from polarity tracking to presence tracking. Under this unipolar framework, a digital 1 is thus represented by the presence of a strong Neodymium N35 disc magnet (8mm diameter x 3mm thickness) oriented with its North face pointing toward the sensor. When passing the sensing head, this magnet should produce a positive EMF spike. Similarly, a digital 0 is now represented by empty space or silence along the track. This leaves the circuit at its baseline voltage showing no induced signal.

## **4.2 Finalized Experimental Setup**

The sensor core was itself constructed by hand winding 387 turns of 20 AWG enameled copper wire around the structural iron bolt. The windings were arranged in a barrel shaped taper with heavy bias toward the sensor tip to maximize flux concentration (Figure 2). The steel paperclip seeking tip was mounted to the tip of the bolt. 

![][image2]

Figure 2: Physical experimental setup used to take data

As stated before, to ensure consistent and repeatable kinematics across all trials, a vertical gravity guide rail was constructed. The physical data strips were placed within the rail and dropped from rest 16 mm above the seeking tip. The total transit time for the data strip to completely clear the sensor tip spanned approximately 0.21 seconds across all trials. The full flowchart of the governing processes can be seen below in Figure 3\.

![][image3]

Figure 3\. Flow chart of processes governing the experimental setup

## **4.3 Calibration**

Because the system’s encoding was altered to look for the presence of a magnetic field through its induction, the microcontroller could no longer rely on a simple  fixed interval time clock to read incoming bits. Due to gravitational acceleration, a 0 (empty space) at the top of the track takes a significantly longer time to pass the sensor than an identical 0 at the bottom of the track. Hence, to map out these shrinking time windows fully, a series of calibration trials were required.

Furthermore, calibration was also required because geometric irregularities in the hand-wound coil meant the experimental sensor’s output would not perfectly match the raw textbook theoretical curve. Besides helping map out the correct time windows, using a series of calibrations had a second added benefit. By implementing various different spacings with an encoded string of 11111, the calibration data also helped evaluate how close adjacent bits could be before their magnetic fields bled into each other. In other words, this allowed for the determination of the system’s resolution limit.

To achieve this, the calibration matrix involved collecting data across three distinct magnet intervals (32 mm, 40 mm, and 48 mm) using a test code of 11111\. These specific spacings were chosen because they represent whole multiples of the disc magnets’ diameters. In total, 15 calibration datasets were recorded (5 runs per spacing layout) to generate stable baselines for each spacing type.

## **4.4 Test Sequences**

Following the calibration phase, four distinct binary code strips were created to test the sensor's performance across various bit configurations, alongside a continuous 11111 control strip as seen in Table 1 below.

![][image4]

Table 1: Binary sequences tested and their significance

It is to be noted that, every test sequence was designed with an initial 1 at the start (designated as the “start bit”). Because an empty space (0) is completely silent to the inductive sensor, starting a drop sequence with a zero would leave the exact entry time of the falling track indeterminate. The leading magnet thus acts as a start signal by inducing the first major voltage spike and synchronizing the decoding clock for later analysis.

Finally, data collection was executed via the Arduino IDE serial monitor environment and was configured to a transmission rate of 115,200 baud. This high sampling frequency was implemented to ensure that sampling resolution would not result in accidental smeared peaks.

# **5\. Analysis, Results, and Discussion**

## **5.1 Calibration**

To create a model to account for non-ideal situations, a series of 5 calibration tests were performed. Each test involved dropping a magnetic strip with 5 magnets installed, with constant spacing. The strip was dropped past our solenoid, generating a voltage which is read by an ESP-32. The dataset is taken from the microcontroller and is processed in a python script. The script generates a voltage over time graph from the dataset, and generates “windows” by finding midpoints between peaks, as shown in Figure 4\. These windows are generated for all 5 calibrations, then the window barriers are averaged to obtain a calibrated window for tests. These calibrations were repeated for several different spacings.

![][image5]  
Figure 4\. A calibration curve, which shows 5 peaks (each representing a magnet passing by the sensor) and yellow dashed lines indicating windows where the magnets passed by the sensor. 

##  **5.2 Testing**

In order to determine the validity of our magnetic “key”, the calibration windows were used to determine whether a magnet was present or not. Similar to the calibration, a magnetic strip with some magnets removed (to make the key) was dropped past a solenoid and voltage changes were recorded. The dataset was fed to a python script, which generated a voltage over time graph as shown in Figure 5\. This graph also has windows generated from calibration tests. The code is then determined from the graph using an algorithm, which consists of checking whether there is a voltage increase within a window. If there is an increase in voltage, a magnet was detected within the window, and a “1” is recorded. If the voltage either only decreases or stays constant, a “0” is recorded. This code is then displayed and compared to the expected code. If the code is the same, it “passes”, but if there is a variation it “fails”.  
![][image6]

Figure 5\. Test graph with magnet code 10110\. The figure shows 3 peaks, representing the 3 magnets. Looking between the yellow dashed lines, you can see the peaks begin (increase) in the first, third, and fourth windows, indicating a code of “1” in those peaks.

## **5.3 Results**

For our tests with magnets of a spacing of 32 mm, we were unable to get a proper calibration as the peaks began to merge due to the reading speed of the ESP-32 being too slow, which is shown in Figure 6\. However, we were able to calibrate and successfully read every test for magnet spacings of 40 mm and 48 mm. The tests that passed are listed in Figure 6 as well, and no tests failed. We were unable to record errors due to our data generating essentially “bits”, only registering 1s and 0s. This is the result of the voltage amplifier over-amplifying, spiking the readings to the max the ESP-32 could read, leading to essentially only the minimum value read or maximum. 

![][image7]![][image8]  
Figure 6\. The first image shows the test cases that passed. The second image shows a graph of the calibration curve for a magnet spacing of 32 mm, which should have 5 peaks for 5 magnets, however the last magnet “merged” peaks.

## **5.4 Analysis with Comparison to Theoretical**

While the data generated only shows peaks, a comparison to a theoretical graph can still be made. In Figure 7, we can see one of the tests plotted over the theoretical graph, which is generated by the equation also shown in Figure 7\. As seen in the graph, the theoretical does not match well with the peaks in the experimental. This is the reason we performed calibration tests, as poor sensor quality and non-ideal conditions led to significant differences from the expected graph. These calibration tests allowed for us to account for poor conditions.   
![][image9]  
![][image10]  
Figure 7\. Above is the Theoretical plot compared to the experimental plot. The theoretical plot is generated from the equation below the graph, which is a derivation of Lenz’s Law and Biot-Savarts law using kinematic equations.

# **6\. Conclusion**

This experiment showed changes in voltages from a changing magnetic field can be used in order to decode magnetic bits. This is backed up by the experimental data, where while the theoretical model did not match the experimental, we were able to use calibration data in order to get consistently correct decryption of a magnetic strip “key”. Every single test performed with different magnetic keys resulted in a correct output, with no failures once the distance between magnets surpassed 32 mm. The results of this experiment demonstrate why some hotels use magnetic key strips to unlock doors, however with a much more refined setup with a more precise strip.

Some improvements that can be made include tuning our amplifier to amplify the voltage less, as it consistently amplifies to the maximum voltage possibly read by the microcontroller. Other improvements include switching to a higher quality microcontroller, capable of greater voltage readings and resolution as well as having the capability to read negative voltages. The latter improvement to the microcontroller can also be achieved by supplying the microcontroller with a constant, small voltage in order to read drops below the supplied voltage in order to read negative values. Finally, one more improvement that could be made is to improve the setup to reach more ideal conditions, such as reducing friction and having a more constant setup.

# **7\. References**

Boylestad, R. L., & Nashelsky, L. (2012). *Electronic Devices and Circuit Theory* (11th ed.). Pearson.

Serway, Raymond A. *Physics for Scientists and Engineers*. 2nd ed., Saunders College Publishing, 1986\.

# **8\. Appendix**

[image1]: ../assets/labs/solenoid_lab_image1.png

[image2]: ../assets/labs/solenoid_lab_image2.png

[image3]: ../assets/labs/solenoid_lab_image3.png

[image4]: ../assets/labs/solenoid_lab_image4.png

[image5]: ../assets/labs/solenoid_lab_image5.png

[image6]: ../assets/labs/solenoid_lab_image6.png

[image7]: ../assets/labs/solenoid_lab_image7.png

[image8]: ../assets/labs/solenoid_lab_image8.png

[image9]: ../assets/labs/solenoid_lab_image9.png

[image10]: ../assets/labs/solenoid_lab_image10.png