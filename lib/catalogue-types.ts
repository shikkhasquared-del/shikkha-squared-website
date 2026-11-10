// The public projection returned by the CMS. Private lesson URLs and notes are
// absent unless a lesson is explicitly a free preview.
export type PublicLesson={title:string;kind:string;duration?:string;free:boolean;resourceUrl?:string;notes?:string};
export type Course={id:string;title:string;subject:string;teacher:string;board:string;pathway:string;format:string;description?:string;coverUrl?:string;priceMinor:number|null;enrolUrl?:string;reference?:boolean;level?:string;sectionIds?:string[];instructorId?:string;sourceUrl?:string;checkout?:boolean;lessons:PublicLesson[]};
export type Section={id:string;slug:string;title:string;description?:string;imageUrl?:string;mode:string;board:string;level:string;format:string;order?:number};
export type Instructor={id:string;slug?:string;title:string;subjects:string;designation?:string;bio?:string;qualifications?:string;institution?:string;photoUrl?:string;featureVideoUrl?:string;sourceUrl?:string;aliases?:string;order?:number};
export type SiteSettings={title?:string;tagline?:string;heroHeadline?:string;heroDescription?:string;supportEmail?:string;supportPhone?:string;address?:string;seoTitle?:string;seoDescription?:string;catalogueEnabled?:boolean;announcement?:string};
export type Campaign={id:string;placement:string;headline:string;body?:string;imageUrl?:string;destinationUrl?:string;cta?:string};
export type PublicContent={id:string;title:string;type:string;body:string;imageUrl?:string;linkUrl?:string;linkLabel?:string};
export type Catalogue={courses:Course[];sections:Section[];instructors:Instructor[];settings:SiteSettings;campaigns:Campaign[];content?:PublicContent[]};
export type PublishedCatalogue=Omit<Catalogue,'settings'>&{initialized:boolean;catalogueEnabled:boolean;settings:SiteSettings|null};
