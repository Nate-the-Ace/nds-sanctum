import type { CardDef } from '@sanctum/engine';
import caravan from './caravan';
import cleansingLight from './cleansingLight';
import elvenPiper from './elvenPiper';
import faerieFire from './faerieFire';
import faerieGlade from './faerieGlade';
import faerieGladeSquare from './faerieGladeSquare';
import fountainOfYouth from './fountainOfYouth';
import youth from './youth';
import filigreedArmor from './filigreedArmor';
import flight from './flight';
import healingHands from './healingHands';
import oasis from './oasis';
import pacifism from './pacifism';
import pyx from './pyx';
import redeemersSword from './redeemersSword';
import vivant from './vivant';
import wellspring from './wellspring';

export const lifeCards: CardDef[] = [
  caravan, flight, cleansingLight, pyx, healingHands, oasis, wellspring,
  redeemersSword, filigreedArmor, pacifism, vivant, faerieFire, elvenPiper,
  fountainOfYouth, youth, faerieGlade, faerieGladeSquare,
];
