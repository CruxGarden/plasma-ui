import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlasmaProvider, PlasmaButton, PlasmaSwitch, PlasmaSlider, PlasmaTabs, PlasmaTabList, PlasmaTab, PlasmaTabPanel, PlasmaAccordion, PlasmaAccordionItem } from '../../src';
function App() {
 const [on,setOn]=useState(false);
 return <PlasmaProvider><button>Before tabs</button>
 <PlasmaTabs><PlasmaTabList aria-label="No default"><PlasmaTab value="disabled" disabled>Disabled</PlasmaTab><PlasmaTab value="one">One</PlasmaTab><PlasmaTab value="two">Two</PlasmaTab></PlasmaTabList><PlasmaTabPanel value="one">First panel</PlasmaTabPanel><PlasmaTabPanel value="two">Second panel</PlasmaTabPanel></PlasmaTabs>
 <PlasmaTabs defaultValue="a b"><PlasmaTabList aria-label="Distinct IDs"><PlasmaTab value="a b">Space</PlasmaTab><PlasmaTab value="a_b">Underscore</PlasmaTab></PlasmaTabList><PlasmaTabPanel value="a b">Space panel</PlasmaTabPanel><PlasmaTabPanel value="a_b">Underscore panel</PlasmaTabPanel></PlasmaTabs>
 <PlasmaAccordion defaultValue={['outer']}><PlasmaAccordionItem value="outer" title="Outer"><PlasmaAccordion defaultValue={['inner']}><PlasmaAccordionItem value="inner" title="Inner">Nested body</PlasmaAccordionItem><PlasmaAccordionItem value="other" title="Other inner">Other body</PlasmaAccordionItem></PlasmaAccordion></PlasmaAccordionItem><PlasmaAccordionItem value="last" title="Last outer"><a href="#closed">Last body link</a></PlasmaAccordionItem></PlasmaAccordion>
 <PlasmaSlider aria-label="Stepped" defaultValue={25} step={10}/>
 <PlasmaSwitch label="Controlled" checked={on} onCheckedChange={setOn}/><output>{on?'On':'Off'}</output>
 <PlasmaSwitch label="Disabled switch" disabled/><PlasmaButton disabled>Disabled button</PlasmaButton>
 </PlasmaProvider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
