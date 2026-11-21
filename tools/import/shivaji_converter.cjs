// Shivaji01 to Unicode Devanagari Converter
// Based on Sanskrit-Coders font converter, adapted for CLI / automation.



function convert_to_unicode()
{

var array_one = new Array(   'iM' , '|',
"K",'#', "k","@","G", "g","\=",
"C","c","J","j","H",
"z","T","Z","D", "N",
"q","t","%","Q","d","n",

"f", "p", "P", "B","b","m",
"y","r","l","v","S","Y", "s", "h",

'p`', "`", '\/', "x","~","&",  "V", "Ù", "E", "\(", "w", "É", "$", "Ë", "W", "\<", '>', '_',
"AaO", 'AÝ' , "Aao", "Aa", "A", "eo", "e", "š", "[", "]", "?",    "¸", ".",  " aa",  " a" ,

"\\", "्a", "Ý", "aO", "O", "I", "U", "u", "R", "ao", "o", "a", '^M' , 'M', "Á",

"³" , '\´' ,  '््' )



var array_two = new Array(  'Mi', 'ऽ',
"ख", 'ख्', "क","क्","घ्","ग्","ङ",
"छ","च्","झ्","ज्","ञ्",
"ठ","ट","ढ", "ड", "ण्",
"थ्","त","त्","ध्","द","न्",

"फ", "प", "प्", "भ्", "ब्", "म्",
"य्", "र","ल्","व्","श्","ष्","स्", "ह",

'प्र्', "्र", "्र", "क्ष्", "त्र","ज्ञ",  "द्य", "न्न", "श्र्", "ह्म", "द्ध", "रु", "रू", "क्र", "द्व", "त्त्", 'क्त', 'द्द',
"औ", "औ", "ओ", "आ", "अ","ऐ", "ए", "ई", "इ", "उ", "ऋ", "," , "|" , " ||" ,  " |" ,
"्", "" , "ौ", "ौ", "ै", "ी", "ू", "ु", "ॄ", "ो",  "े", "ा", 'ँ' , 'ं', ':' ,
'\(' , '\)', '्'  )

var array_one_length = array_one.length ;


      document.getElementById("unicode_text").value = "You have chosen SIMPLE TEXT  in Shivaji font to convert into Unicode. Conversion in progress.."  ;  

      var modified_substring = document.getElementById("legacy_text").value  ;


//***********************************************************************
//  Break the long text into small bunches of max. max_text_size  characters each.
//***********************************************************************
    var text_size = document.getElementById("legacy_text").value.length ;

    var processed_text = '' ;  //blank

    var sthiti1 = 0 ;  var sthiti2 = 0 ;  var chale_chalo = 1 ;
 
    var max_text_size = 6000;

    while ( chale_chalo == 1 ) 
    {
     sthiti1 = sthiti2 ;

     if ( sthiti2 < ( text_size - max_text_size ) )  
     { 
      sthiti2 +=  max_text_size ;
      while (document.getElementById("legacy_text").value.charAt ( sthiti2 ) != ' ') {sthiti2--;}
     } 
     else  { sthiti2 = text_size  ;  chale_chalo = 0 }

      modified_substring = document.getElementById("legacy_text").value.substring ( sthiti1, sthiti2 )  ;

      Replace_Symbols( ) ;

      var processed_text = processed_text + modified_substring ;

//  Breaking part code over

      document.getElementById("unicode_text").value = processed_text  ;

    }



 //--------------------------------------------------

 function Replace_Symbols( )
    {
     //substitute array_two elements in place of corresponding array_one elements

     if ( modified_substring != "" )  // if string to be converted is non-blank then no need of any processing.
        {
         for(input_symbol_idx = 0;   input_symbol_idx < array_one_length;    input_symbol_idx++ )
            {
             indx = 0  ;  // index of the symbol being searched for replacement
             
             while (indx != -1 ) //whie-00
                {
                 modified_substring = modified_substring.replace( array_one[ input_symbol_idx ] , array_two[input_symbol_idx] )
                 indx = modified_substring.indexOf( array_one[input_symbol_idx] )

                } // end of while-00 loop
            } // end of for loop


//*************************************************************
// Code for Replacing four Special glyphs
//*************************************************************


  var position_of_i = modified_substring.indexOf( "i" )

  while ( position_of_i != -1 )  //while-02
  {
   var charecter_next_to_i = modified_substring.charAt( position_of_i + 1 )
   var charecter_to_be_replaced = "i" + charecter_next_to_i
   modified_substring = modified_substring.replace( charecter_to_be_replaced , charecter_next_to_i + "ि" ) 
   position_of_i = modified_substring.search( /i/ , position_of_i + 1 ) // search for i ahead of the current position.

  } // end of while-02 loop

//*****************************************************
// End of Code for Replacing four Special glyphs
//*****************************************************
//
// following loop to eliminate 'chhotee ee kee maatraa' on half-letters as a result of above transformation.

var position_of_wrong_ee = modified_substring.indexOf( "ि्" ) 

while ( position_of_wrong_ee != -1 )  //while-03

{
var consonent_next_to_wrong_ee = modified_substring.charAt( position_of_wrong_ee + 2 )
var charecter_to_be_replaced = "ि्" + consonent_next_to_wrong_ee 
modified_substring = modified_substring.replace( charecter_to_be_replaced , "्" + consonent_next_to_wrong_ee + "ि" ) 
position_of_wrong_ee = modified_substring.search( /ि्/ , position_of_wrong_ee + 2 ) // search for 'wrong ee' ahead of the current position. 

} // end of while-03 loop


//***********************************************************************
//Eliminating reph "-" and putting 'half - r' at proper position for this.
//***********************************************************************

        set_of_matras = "ािीुूृेैोौंःँॅ" 
         var position_of_reph = modified_substring.indexOf( "-" )

        while( position_of_reph > 0 )  // while-04
        {
             probable_position_of_half_r = position_of_reph - 1 ;
             var charecter_at_probable_position_of_half_r = modified_substring.charAt( probable_position_of_half_r )

             // trying to find non-maatra position left to current O (ie, half -r).

             while( set_of_matras.match( charecter_at_probable_position_of_half_r ) != null )  // while-05
                {
                 probable_position_of_half_r = probable_position_of_half_r - 1 ;
                 charecter_at_probable_position_of_half_r = modified_substring.charAt( probable_position_of_half_r ) ;

                }// end of while-05

             charecter_to_be_replaced = modified_substring.substr ( probable_position_of_half_r , ( position_of_reph - probable_position_of_half_r ) ) ;
             new_replacement_string = "र्" + charecter_to_be_replaced ; 
             charecter_to_be_replaced = charecter_to_be_replaced + "-" ;
             modified_substring = modified_substring.replace( charecter_to_be_replaced , new_replacement_string ) ;
             position_of_reph = modified_substring.indexOf( "-" ) ;
         }// end of while-04
		 
    }//end of IF  statement  meant to  supress processing of  blank  string.

    } // end of the function  Replace_Symbols

 } // end of legacy_to_unicode function

 
function Convert_to_Shivaji_Font()
{

var array_one = new Array( 

"|" ,	"ऽ" ,
"\\" ,	"्" ,

"K" ,	"ख" ,
"#" ,	"ख्" ,
"k" ,	"क" ,
"@" ,	"क्" ,
"G" ,	"घ्" ,
"g" ,	"ग्" ,
"\=" ,	"ङ" ,
"C" ,	"छ" ,
"ca" ,	"च" ,
"c" ,	"च्" ,
"Ja" ,	"झ" ,
"J" ,	"झ्" ,
"ja" ,	"ज" ,
"j" ,	"ज्" ,
"H" ,	"ञ्" ,
"z" ,	"ठ" ,
"T" ,	"ट" ,
"Z" ,	"ढ" ,
"D" ,	"ड" ,
"Na" ,	"ण" ,
"N" ,	"ण्" ,
"qa" ,	"थ" ,
"q" ,	"थ्" ,
"t" ,	"त" ,
"%" ,	"त्" ,
"Qa" ,	"ध" ,
"Q" ,	"ध्" ,
"d" ,	"द" ,
"na" ,	"न" ,
"n" ,	"न्" ,
"f" ,	"फ" ,
"p" ,	"प" ,
"P" ,	"प्" ,
"Ba" ,	"भ" ,
"B" ,	"भ्" ,
"ba" ,	"ब" ,
"b" ,	"ब्" ,
"m" ,	"म्" ,
"ma" ,	"म" ,
"ya" ,	"य" ,
"y" ,	"य्" ,
"r" ,	"र" ,
"la" ,	"ल" ,
"l" ,	"ल्" ,
"va" ,	"व" ,
"v" ,	"व्" ,
"Sa" ,	"श" ,
"S" ,	"श्" ,
"Ya" ,	"ष" ,
"Y" ,	"ष्" ,
"sa" ,	"स" ,
"s" ,	"स्" ,
"h" ,	"ह" ,

//"`" ,	"्र" ,
"\/" ,	"्र" ,

"C" + "`" ,	"छ" + "्र" ,
"z" + "`" ,	"ठ" + "्र" ,
"T" + "`" ,	"ट" + "्र" ,
"Z" + "`" ,	"ढ" + "्र" ,
"D" + "`" ,	"ड" + "्र" ,

"p`" ,	"प्र्" ,
"xa" ,	"क्ष" ,
"x" ,	"क्ष्" ,
"~" ,	"त्र" ,
"\&" ,	"ज्ञ" ,
"V" ,	"द्य" ,
"Ù" ,	"न्न" ,
"E" ,	"श्र्" ,
"\(" ,	"ह्म" ,
"w" ,	"द्ध" ,
"Ë" ,	"क्र" ,
"W" ,	"द्व" ,
"\<" ,	"त्त्" ,
"\>" ,	"क्त" ,
"_" ,	"द्द" ,

"AaO" ,	"औ" ,
"AÝ" ,	"औ" ,
"Aao" ,	"ओ" ,
"Aa" ,	"आ" ,
"A" ,	"अ" ,
"e" ,	"ए" ,
"š" ,	"ई" ,
"[" ,	"इ" ,
"]" ,	"उ" ,
"\?" ,	"ऋ" ,

"¸" ,	"," ,
"." ,	"|" ,

"Ý" ,	"ौ" ,
"aO" ,	"ौ" ,
"O" ,	"ै" ,
"I" ,	"ी" ,
"U" ,	"ू" ,
"u" ,	"ु" ,
"R" ,	"ॄ" ,
"ao" ,	"ो" ,
"o" ,	"े" ,
"a" ,	"ा" ,
"^M" ,	"ँ" ,
"M" ,	"ं" ,
"Á" ,	":" ,

"É" ,	"रु" ,
"$" ,	"रू" ,

"³" ,	"\(" ,
"´" ,	"\)"    )

var array_one_length = array_one.length ;

var modified_substring = document.getElementById("unicode_text").value  ;


//****************************************************************************************
//  Break the long text into small bunches of max. max_text_size  characters each.
//****************************************************************************************
    var text_size = document.getElementById("unicode_text").value.length ;

    var processed_text = '' ;  //blank

    var sthiti1 = 0 ;  var sthiti2 = 0 ;  var chale_chalo = 1 ;
 
    var max_text_size = 6000;

    while ( chale_chalo == 1 ) 
    {
     sthiti1 = sthiti2 ;

     if ( sthiti2 < ( text_size - max_text_size ) )  
     { 
      sthiti2 +=  max_text_size ;
      while (document.getElementById("unicode_text").value.charAt ( sthiti2 ) != ' ') {sthiti2--;}
     } 
     else  { sthiti2 = text_size  ;  chale_chalo = 0 }

      modified_substring = document.getElementById("unicode_text").value.substring ( sthiti1, sthiti2 )  ;

      Replace_Symbols( ) ;

      var processed_text = processed_text + modified_substring ;

      document.getElementById("legacy_text").value = processed_text  ;

    }
  	
	
	
 //--------------------------------------------------

 function Replace_Symbols( )
    {	
	
// to force halant at last letter
modified_substring = modified_substring.replace( /्([ \r\n\,\।])/g , '\\$1' ) ;


// replace two-byte nukta varnas with single byte nukta varnas
modified_substring = modified_substring.replace( 'ज' + '़' , 'ज़' ) ;
modified_substring = modified_substring.replace( 'ज' + '्' + '़' , 'ज़्' ) ;
modified_substring = modified_substring.replace( 'ड' + '़' , 'ड़' ) ;
modified_substring = modified_substring.replace( 'ढ' + '़' , 'ढ़' ) ;

// code for replacing "ि" (chhotee ee kii maatraa) with "i" and correcting its position too.
        
        var position_of_i = modified_substring.indexOf( "ि" )  ;
         while ( position_of_i != -1 )  //while-02
           {
            var character_left_to_i = modified_substring.charAt( position_of_i - 1 )  ;
            modified_substring = modified_substring.replace( character_left_to_i + "ि" ,  "i" + character_left_to_i )  ;

            position_of_i = position_of_i - 1  ;

            while (( modified_substring.charAt( position_of_i - 1 ) == "्" )  &  ( position_of_i != 0  ) )
               {
                var string_to_be_replaced = modified_substring.charAt( position_of_i - 2 ) + "्"  ;
                  modified_substring = modified_substring.replace( string_to_be_replaced + "i", "i" + string_to_be_replaced ) ;

                position_of_i = position_of_i - 2  ;
               }
            position_of_i = modified_substring.search( /ि/ , position_of_i + 1 ) ; // search for f ahead of the current position.

           } // end of while-02 loop
 
//************************************************************     
        // Eliminating "र्" and putting "-"  at proper position for this.

       set_of_matras = "ािीुूृेैोौं:ँॅ" 

modified_substring += '  '    ;  // add two spaces after the string to avoid UNDEFINED char in the following code.

       var position_of_half_R = modified_substring.indexOf( "र्" ) ;
        while ( position_of_half_R > 0  )  // while-04
           {
            // "र्"  is two bytes long
			if ( modified_substring.charAt( position_of_half_R + 3 ) != '्' )   
	              { var probable_position_of_Z = position_of_half_R + 2 }
        else  var probable_position_of_Z = position_of_half_R + 4 ; 

            var character_right_to_probable_position_of_Z = modified_substring.charAt( probable_position_of_Z + 1 )

            // trying to find non-maatra position right to probable_position_of_Z .

            while ( set_of_matras.indexOf( character_right_to_probable_position_of_Z ) != -1 )  
               {
                probable_position_of_Z = probable_position_of_Z + 1 ;
                character_right_to_probable_position_of_Z = modified_substring.charAt( probable_position_of_Z + 1 ) ;
               } // end of while-05

            string_to_be_replaced = modified_substring.substr ( position_of_half_R + 2 , ( probable_position_of_Z - position_of_half_R - 1 ))  ;
            modified_substring = modified_substring.replace( "र्" + string_to_be_replaced  ,  string_to_be_replaced + "-" ) ;
            position_of_half_R = modified_substring.indexOf( "र्" ) ;
           } // end of while-04


        modified_substring = modified_substring.substr ( 0 , modified_substring.length - 2 )  ;
	
	
// ------------------------------------------	
	
         for (input_symbol_idx = array_one_length - 1 ;   input_symbol_idx >= 0 ;    input_symbol_idx = input_symbol_idx - 2 )
            {
             indx = 0  ;  // index of the symbol being searched for replacement
             
             while (indx != -1 ) //whie-00
                {
                 modified_substring = modified_substring.replace( array_one[ input_symbol_idx ] , array_one[input_symbol_idx -1] )
                 indx = modified_substring.indexOf( array_one[input_symbol_idx] )

                } // end of while-00 loop
            } // end of for loop
			
    } // end of the function  Replace_Symbols

 } // end of legacy_to_unicode function

 


global.document = {
  getElementById: (id) => {
    if (!global[id]) global[id] = { value: '' };
    return global[id];
  }
};

function convertShivajiText(input) {
  if (!input || !input.trim()) return input;

  // Pre-clean legacy specific ligatures
  let s = input;
  s = s.replace(/\)dya/g, 'हृदय');
  s = s.replace(/studI/g, 'स्तुति');
  s = s.replace(/stuid/g, 'स्तुति');
  s = s.replace(/P\Bau/g, 'प्रभु');
  s = s.replace(/p\Bau/g, 'प्रभु');
  s = s.replace(/P\omaI/g, 'प्रेमी');
  s = s.replace(/\^MU/g, 'हूँ');

  document.getElementById('legacy_text').value = s;
  convert_to_unicode();
  let out = document.getElementById('unicode_text').value;

  // Post-clean legacy symbols
  out = out.replace(/}/g, 'ऊ');
  out = out.replace(/\]/g, 'उ');
  out = out.replace(/\[\-/g, 'ई');
  out = out.replace(/\[/g, 'इ');
  out = out.replace(/र्इ/g, 'ई');
  out = out.replace(/स्तुदी/g, 'स्तुति');
  out = out.replace(/स्तुदि/g, 'स्तुति');
  out = out.replace(/पभु/g, 'प्रभु');
  out = out.replace(/\|\|/g, '॥');
  out = out.replace(/\s+\|\s+/g, ' । ');

  return out;
}

module.exports = { convertShivajiText };

if (require.main === module) {
  const fs = require('fs');
  const input = fs.readFileSync(0, 'utf-8');
  process.stdout.write(convertShivajiText(input));
}
