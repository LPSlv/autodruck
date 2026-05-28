; HEADER_BLOCK_START
; ========== machine: A1 ==========
; printer_model = Bambu Lab A1
; printer_model_id = N2S
; model printing time: 1h 23m 45s
; total estimated time: 1h 30m 0s
; total layer number: 120
; total filament length [mm] : 2345.67
; total filament volume [cm^3] : 5.62
; total filament weight [g] : 6.74
; max_z_height: 24.50
; HEADER_BLOCK_END

; EXECUTABLE_BLOCK_START
M73 P0 R90
M201 X10000 Y10000
G28
G1 Z5 F600
G1 X10 Y10
; ... print body ...
G1 X100 Y100
; EXECUTABLE_BLOCK_END
; printable end
