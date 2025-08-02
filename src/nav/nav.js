// src/database/nav.js
import router from "@system.router";

export default class Nav {
  static navIndex() {
    router.push({
      uri: "/pages/index"
    });
  }

  static navDetail() {
    router.push({
      uri: "/pages/detail"
    });
  }

  static navRecord() {
    router.push({
      uri: "/pages/record"
    });
  }

  static navAbout() {
    router.push({
      uri: "/pages/about"
    });
  }

  static navNote() {
    router.push({
      uri: "/pages/note"
    });
  }

  static navAnalysis(){
    router.push({
      uri:"/pages/analysis"
    })
  }
  
  static navTest(){
    router.push({
      uri:"/pages/test"
    })
  }
}