import type { CardDef } from '@sanctum/engine';
import berserkerBlade from './berserkerBlade';
import berserkers from './berserkers';
import bloodlust from './bloodlust';
import dragonSlayer from './dragonSlayer';
import fireball from './fireball';
import flamingSword from './flamingSword';
import goodOfTheMany from './goodOfTheMany';
import legionnaires from './legionnaires';
import ngozisWay from './ngozisWay';
import palisade from './palisade';
import plains from './plains';
import rainOfArrows from './rainOfArrows';
import scorchedEarth from './scorchedEarth';
import shatteringBlow from './shatteringBlow';
import swashbuckler from './swashbuckler';
import thermiteDamage from './thermiteDamage';
import thermites from './thermites';
import volcano from './volcano';
import veteran from './veteran';
import marksman from './marksman';
import fieldSurgery from './fieldSurgery';
import fieldSurgeryScar from './fieldSurgeryScar';
import warDrums from './warDrums';
import pointOfClarity from './pointOfClarity';
import callToArms from './callToArms';
import forcedMarch from './forcedMarch';
import amok from './amok';
import armistice from './armistice';
import skirmish from './skirmish';
import fogOfWar from './fogOfWar';
import loneWolf from './loneWolf';
import salamander from './salamander';
import brimstoneDragon from './brimstoneDragon';
import wyrmling from './wyrmling';
import wyrmlingHide from './wyrmlingHide';
import hellion from './hellion';
import firewyrm from './firewyrm';
import warlord from './warlord';
import warlordCommand from './warlordCommand';
import decoy from './decoy';
import decoyRuse from './decoyRuse';
import dragonsTeeth from './dragonsTeeth';
import ngozi from './ngozi';
import ngozisBlight from './ngozisBlight';
import vladHrothgar from './vladHrothgar';
import riteOfGrowth from './riteOfGrowth';
import cannon from './cannon';
import flamingArrows from './flamingArrows';
import bookOfWar from './bookOfWar';
import challenge from './challenge';
import { growingStrifeCards } from './growingStrife';

export const warCards: CardDef[] = [
  flamingSword, bloodlust, legionnaires, ngozisWay, palisade, warDrums, swashbuckler,
  fireball, goodOfTheMany, plains, volcano, scorchedEarth, dragonSlayer,
  berserkerBlade, berserkers, rainOfArrows, shatteringBlow,
  thermites, thermiteDamage,
  veteran, marksman, fieldSurgery, fieldSurgeryScar,
  pointOfClarity, callToArms,
  forcedMarch, amok,
  armistice, skirmish,
  fogOfWar, loneWolf,
  salamander, brimstoneDragon, wyrmling, wyrmlingHide, hellion, firewyrm,
  warlord, warlordCommand, decoy, decoyRuse, dragonsTeeth,
  ngozi, ngozisBlight, vladHrothgar, riteOfGrowth,
  cannon, flamingArrows,
  bookOfWar, challenge, ...growingStrifeCards,
];
