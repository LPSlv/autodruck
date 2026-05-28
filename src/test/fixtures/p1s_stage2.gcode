; HEADER_BLOCK_START
; ========== machine: P1S ==========
; printer_model = Bambu Lab P1S
; printer_model_id = C12
; model printing time: 0h 45m 10s
; total estimated time: 0h 50m 0s
; total layer number: 60
; total filament length [mm] : 1100.00
; total filament volume [cm^3] : 2.65
; total filament weight [g] : 3.18
; max_z_height: 12.00
; HEADER_BLOCK_END

; EXECUTABLE_BLOCK_START
M73 P0 R50
M201 X10000 Y10000
M203 X500 Y500
M204 P10000
M205 X9 Y9
G28
G1 Z5 F600
; print body
; EXECUTABLE_BLOCK_END
