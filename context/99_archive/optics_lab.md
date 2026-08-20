# **Characterization of Geometric and Wave Optics Using Physical Methods and Digital Imaging**

Physics 4BL, Spring 2026, May 15  
Lab Section 6, Table 4

**Ethan Chang, Victor Gusev**  
---

# **1\. Abstract**

In this experiment, both the geometric and wave properties of light were examined via refraction, total internal reflection, lens optics, and double slit diffraction. A prism, three lenses (double convex, double concave, and plano convex), and a double slit apparatus were used to experimentally determine the critical angle, refractive indices, focal lengths, and laser wavelength. For the prism experiment, the critical angle for total internal reflection was measured and used with Snell’s Law to calculate the refractive index of the prism material. The experimentally determined refractive index was 1.706 which had an error of 14.14% relative to the accepted value of 1.495. Lens behavior was then analyzed using ray tracing and the Lensmaker’s Equation to calculate refractive indices from measured focal lengths and radii of curvature. The plano convex and double convex lenses produced values within approximately 3% of the accepted refractive index while the double concave lens showed a significantly larger error of about 18% which was likely attributed to the difficulty of estimating a virtual focal point. Finally, the wave nature of light was examined through double slit diffraction using an ESP32 camera and image processing in Jupyter Notebook. Experimental intensity data were fitted to the theoretical diffraction model using a least squares fitting to estimate the laser’s wavelength to be approximately 651 nm and the resulting diffraction pattern closely matched the theoretical model despite minor misalignments. Overall, the experiment demonstrated that geometric and wave optics models accurately describe the behavior of light within reasonable experimental uncertainty.

# **2\. Introduction**

Light contains both particle like and wave like properties which can be modeled through geometric and wave optics. In this experiment, both models were experimentally examined through the behavior of light’s interactions with prisms, lenses, and a double slit apparatus. The purpose of this experiment was to experimentally derive critical angle, focal length, refractive index, and laser wavelength through direct measurement and analysis in Jupyter Notebook.

## **2.1 Refraction and Total Internal Reflection**

According to Snell’s Law, when light travels between materials with different refractive indices, its speed changes which in turn causes the light to refract at a new angle. More specifically, if light travels from a material with a higher refractive index into one with a lower refractive index, there will be a maximum angle of incidence for which refraction can occur (Serway 781). Past this angle, total internal reflection occurs. This angle is known as the critical angle and is given by Equation 1\.

sin(c)=n1n2                                                           (1)

where (n1)​ is the refractive index of the initial medium and (n2)​ is the refractive index of the second medium. In this experiment, the prism material had a refractive index of n1 \= 1.495 while air was taken to have a refractive index of n2 \= 1.000.

## **2.2 Lens Optics**

This experiment also analyzed the focusing and diverging properties of various lenses. Three lenses were studied (double convex, double concave, and plano convex). The behavior of these lenses depends on the curvature of their surfaces and the refractive index of the lens material. 

As described by the Lensmaker’s equation (Equation 2), the behavior of these lenses depends on the curvature of their surfaces and the refractive index of the lens’ material (Serway 803). 

1f=(n-1)(1R1-1R2)                                                     (2)

In Equation 2, (f) is the focal length, (n) is the refractive index of the lens material, and (R1)​ and (R2​) are the radii of curvature of the lens surfaces. It should also be noted that the sign of each radius depends on the direction of curvature relative to the incident light and that, for the case of the plano convex lens, the flat surface is taken to have an infinite radius of curvature. 

However, the thin lens approximation relies on the assumption that the lens thickness is much smaller than the radius of curvature. While this simplifies analysis, real lenses possess finite thickness which may introduce slight deviations between theoretical and experimental results.

## **2.3 Double Slit Diffraction and Interference**

The second portion of the experiment examined the wave nature of light through double slit diffraction and interference. When light passes through two narrow slits, the light waves interfere constructively and destructively which results in an alternating pattern of bright and dark fringes projected onto a screen (Serway 814).

The diffraction pattern depends on the four parameters of separation between the slits (D), slit width (d), distance from the slits to the screen (b), and the wavelength of the light (λ) with the theoretical intensity distribution for a double slit diffraction pattern being described by Equation 3\.

I(x)=I0cos2(Dxb)(sin(dxb)dxb)2                                             (3)

where the cosine term describes the interference fringes and the second term involving the sine represents the single slit diffraction envelope.

# **3\. Methods**

## **3.1 Prism and Lens Measurements**

A ray box was used to generate a single beam of light which was directed at a prism. The prism was slowly rotated until total internal reflection occurred at the second interface between the prism and air as seen in Figure 1\. The setup was traced onto a white sheet of paper and then the angle corresponding to this condition was measured experimentally with a protractor. Finally, the experimentally found angle was compared to the theoretical critical angle which was calculated using the known refractive indices of the prism material and air as well as Equation 1\.

![][image1]  
Figure 1\. Example of critical angle on a prism (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 4, 2026\)

As stated above three lens geometries as shown below in Figure 2 were then analyzed (double convex, double concave, and plano convex). To begin, parallel rays from the ray box were directed through each lens onto a sheet of white paper. The outlines of the lenses were then traced and several points along the refracted rays were marked to map the light paths. Next, the refracted rays were extended until the focal point was located. Finally, the focal length of each lens was measured from the center of the lens to the focal point. The radii of curvature of each lens surface was measured directly using a ruler.

![][image2]![][image3]![][image4]  
Figure 2\. Examples of ray behaviors through various lens geometries (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 4, 2026\)

After collecting the relevant values, the experimentally measured focal lengths and radii of curvature were then substituted into the Lensmaker’s Equation to determine the refractive index of the lens material. The calculated refractive indices were compared to the accepted value of n=1.495 and percent error was determined. Uncertainties from measured quantities were propagated through all calculations.

## **3.2 Double Slit Diffraction**

A double slit apparatus was arranged on a single axis with slit separation D \= 0.250 mm, slit width d \= 0.080 mm, and slit to screen distance b between approximately 60 and 100 cm. An ESP32 camera was placed approximately 15 cm from the projection screen as seen in Figure 3\.

![][image5]  
Figure 3\. Double slit diffraction setup (Image taken from Physics 4BL Lab Manual Slide Deck, Unit 4, 2026\)

To calibrate the scale of the images, a square with side lengths of 1 cm was drawn on paper and photographed while the room lights were on (shown in Figure 4). The hexadecimal output from the ESP32 was copied from the serial monitor into a text file and converted into a JPEG image using Python. The calibration image was then used to determine the conversion factor between pixels and physical distance.

![][image6]  
Figure 4\. Calibration image taken for later scaling

After calibration, the room lights were turned off and the diffraction pattern produced by the laser and double slit apparatus was photographed (shown in Figure 5). The hexadecimal image data were again converted into JPEG format using Python and a several pixel wide horizontal line passing through the diffraction pattern was selected and averaged to reduce noise and obtain a one dimensional intensity profile.

![][image7]  
Figure 5\. Image taken of double slit diffraction

Next, the brightness values were normalized and converted into intensity as a function of position on the screen. Distances were converted from pixels to centimeters using the calibration factor and then later into meters. The center of the diffraction pattern was also found by locating the maximum intensity value.

The theoretical double slit diffraction equation was finally defined in Jupyter Notebook and a least squares fitting routine from SciPy was used to fit the theoretical intensity distribution to the experimental data. The wavelength of the laser was treated as the fitting parameter. The fitted wavelength was compared to the theoretical wavelength and percent error was calculated. Again, experimental uncertainties were propagated throughout this portion of the analysis.

# **4\. Analysis, Results, and Discussion**

## **4.1.1 Calculations (Total Refraction)**

To calculate the angle of total refraction, the prism was angled such that the light just barely internally reflected. The prism was then sketched on a piece of paper (as shown in Figure 4), along with the entering light ray. The angle between the 2 is recorded. This angle is then used to calculate the index of refraction of the glass (nglass) by using the equation nairsin(θair)=nglasssin(θglass), where nair is 1.003, θair is 90 degrees or pi/2 radians, and θglass is the measured angle.

##  **4.1.2 Results and Graphs (Total Refraction)**

The results are shown below in Figure 6\.  
![][image8]

Figure 6\. Calculated Values and Percent Error from a theta value of 36 degrees

##  **4.1.3 Discussion (Total Refraction)**

Checking our results, a calculated value of 1.706 was obtained, which is a significant amount off of the expected 1.495. This is most likely caused by various imperfect measurements, such as eyeballing when the light was performing total internal reflection and measuring the angle somewhat imprecisely using a protractor. The glass may have also been a different composition than expected.

## **4.2.1 Calculations (Lens Focal Length)**

To calculate the focal length of each lens, measure the diameter of the lens in the middle and half of the length of the lens. Then, shine several lasers through the lens, and measure the focal point (where the lasers converge). Then, using the equations in Figure 7, calculate the index of refraction with the given values.  
![][image9]![][image10]![][image11]

Figure 7\. Above are the equations and diagrams needed to calculate the index of refraction of a lens. The first image shows you how to calculate the radius of the lens, the second shows what each variable corresponds to, and the last shows the lensmaker equation.

##  **4.2.2 Results and Graphs (Lens Focal Length)**

Below are the results of the calculations in Figure 8\. For Plano Convex, the values calculated were a \= 1.6, b \= 3.6, d \= 1.6, f \= 10.9 (second radius was infinity). For Convex, the values calculated were a \= 1.6, b \= 3.6, d \= 3.2, f \= 6 (second radius was negative). For concave, the values calculated were a \= 1.6, b \= 3.6, d \= 1.3, f \= \-3 (first radius was negative). Below are our final results.

![][image12]![][image13]![][image14]

Figure 8\. Shows the drawings of our experiment and results for each lens.

##  **4.2.3 Discussion (Lens Focal Length)**

While Plano Convex and Convex were relatively close to the expected value, concave strayed by a significant amount. This is most likely due to how accurate each measurement was for each lens. For example, The Concave lens had a negative focal length, meaning the diffraction pattern had to be extrapolated to see the focal length, which may have led to some issues. Some other sources of error may have been imperfections in the ruler measurements of each part of the lens.

## **4.3.1 Calculations (Double Slit)**

To calculate the results of the Double Slit experiment, a photo of a red square of size 1cm x 1cm was taken. This square was used to calibrate the ratio of pixels to size. The lights were then turned off and the double slit experiment was performed (laser shined through narrow slits). A photo of the diffraction pattern is taken, and using the pixels to size ratio as well as a Python script that analyzes the brightness of an image along a line, a graph showing the relationship between brightness and distance is created. This graph is then compared to a model of the expected result, which is generated from the known values of the slit width and distance between slits, as well as distance from screen. The experimental graph has an estimated wavelength by inputting the data into the model and performing a least squares regression fit, which is then compared to the actual wavelength.

##  **4.3.2 Results and Graphs (Double Slit)**

Below in Figure 9 we see a comparison of the experimental to theoretical results, as well as the percent error  
![][image15]

Figure 9\. Results of the Double Slit Experiment, comparing intensity to distance.

##  **4.3.3 Discussion (Lens Focal Length)**

In the diagram, the general shape of the data fits the expected well. There is a noticeable decline in the intensity of the data as distance increases, however that is most likely due to the laser displaying the diffraction pattern at a slight angle in reference to the camera. Had this experiment been repeated, the camera should have been fixed better to a mount and angled properly in comparison to the laser.

# **5\. Conclusion**

The purpose of this experiment was to experimentally derive critical angle, focal length, refractive index, and laser wavelength through direct measurement and analysis in Jupyter Notebook.

Within reasonable uncertainty, the results of this experiment ultimately confirm the initial hypothesis that these experiments can be used to determine different properties of materials and light such as index of refraction, focal lengths, and laser wavelengths.

For the total internal reflection, when performing the experiment the obtained index of refraction was 1.706, which varies from the actual expected by 1.495. This gives us a percent error of 14.14%, which is quite significant. This indicates that there was significant error in the data gathering, such as “eyeball” readings for when the glass began to internally reflect 

For the focal lengths of the lens, the plano convex and convex lens had indices of refraction that were very similar to the actual expected value, both differing by about 2.99%. However, for concave, the percent error is roughly 18%, and the calculated index of refraction is roughly 0.27 greater. The reason why this percent error is likely significantly worse is because the concave lens is harder to measure, as the focal length is negative meaning the light-lines need to be extrapolated to see the focal point. The measurements likely were also worse, as many of the measurements were approximated with a ruler. However, even with some error, we see the Lensmaker Equation is still a good representation of reality in determining the index of refraction of a lens.

Finally, in the double slit experiment, we saw a clear diffraction pattern appear on the screen. This diffraction pattern, while slightly angled, showed a clear increase in intensity matching what we would expect in a theoretical model of the double slit experiment, as shown in the above figures. This indicates that the model accurately describes the experiment. However, our data could be more representative had we taken more precaution with data gathering, such as fixing the camera more rigidly and ensuring it was properly aligned with the laser, as in our data you see the intensity die down both according to the model and linearly as distance increases.

In the future, these experiments can be taken with more care, using more precise equipment as well as more equipment, for example using a sensor that detects when internal reflection is reached for the first experiment.

Overall, despite some sources of error within the experimental setup, the data resulting from this lab suggests validity of various equations such as the Lensmaker equation and the double slit equation.

# **5\. References**

Serway, Raymond A. *Physics for Scientists and Engineers*. 2nd ed., Saunders College Publishing, 1986, pp. 781-814.

[image1]: ../assets/labs/optics_lab_image1.png

[image2]: ../assets/labs/optics_lab_image2.png

[image3]: ../assets/labs/optics_lab_image3.png

[image4]: ../assets/labs/optics_lab_image4.png

[image5]: ../assets/labs/optics_lab_image5.png

[image6]: ../assets/labs/optics_lab_image6.png

[image7]: ../assets/labs/optics_lab_image7.png

[image8]: ../assets/labs/optics_lab_image8.png

[image9]: ../assets/labs/optics_lab_image9.png

[image10]: ../assets/labs/optics_lab_image10.png

[image11]: ../assets/labs/optics_lab_image11.png

[image12]: ../assets/labs/optics_lab_image12.png

[image13]: ../assets/labs/optics_lab_image13.png

[image14]: ../assets/labs/optics_lab_image14.png

[image15]: ../assets/labs/optics_lab_image15.png