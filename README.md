# flux-fcode-tools

The FLUX Beamo is a laser cutter/engraver that uses a Raspberry Pi as half of its brain. The Beam Studio software generates ".fc" files and sends it over to the Pi for each job. The fc file format is proprietary and doesn't look like the G-code that a GRBL laser control circuit would understand. But the microSD card on the Pi had some source code on it that I could read to figure out the fc file format. If you want to dig for it yourself, look for "fcode_executor.py", "device_fsm.cpp", "misc.py", and "test_fsm.py". The code is outdated, more recent firmware updates do not include source code anymore, but the old code remains.

I have written two tools here that can work with the FLUX-Task files:

[fcode2gcode.htm](https://frank26080115.github.io/flux-fcode-tools/fcode2gcode.htm) Converts F-code to G-code, useful for importing into simulation. The G-code cannot be run on other machines because there's some proprietary modifications to GRBL that allows FLUX to send bitmap images much faster than usual.

[fcode4humans.htm](https://frank26080115.github.io/flux-fcode-tools/fcode4humans.htm) Converts F-code binary instructions to a human-readable version (that looks like G-code), and also vice-versa. It also generates visual previews of all cuts and engraving moves. This allows you to edit the F-code directly and also have a preview to know if you screwed up.

I like the Beamo! I'm hacking around it to push a "entry level" device to the limits! Read [my review about it](https://eleccelerator.com/beamo-laser-cutter-review/).
