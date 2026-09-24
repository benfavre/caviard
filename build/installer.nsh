; Register Inklura as an additional PDF handler without changing the default.
!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.benfavre.caviard.pdf" "" "Inklura PDF"
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.benfavre.caviard.pdf\DefaultIcon" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.benfavre.caviard.pdf\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "com.benfavre.caviard.pdf"

  WriteRegStr SHELL_CONTEXT "Software\Classes\SystemFileAssociations\.pdf\shell\InkluraPDF" "" "Caviarder avec Inklura PDF"
  WriteRegStr SHELL_CONTEXT "Software\Classes\SystemFileAssociations\.pdf\shell\InkluraPDF" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\SystemFileAssociations\.pdf\shell\InkluraPDF" "MultiSelectModel" "Document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\SystemFileAssociations\.pdf\shell\InkluraPDF\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\InkluraPDF" "" "Importer les PDF avec Inklura"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\InkluraPDF" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\InkluraPDF\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\InkluraPDF" "" "Importer les PDF avec Inklura"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\InkluraPDF" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\InkluraPDF\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "com.benfavre.caviard.pdf"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\com.benfavre.caviard.pdf"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\SystemFileAssociations\.pdf\shell\InkluraPDF"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\InkluraPDF"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\InkluraPDF"
!macroend
