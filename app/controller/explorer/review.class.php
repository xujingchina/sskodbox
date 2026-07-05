<?php
class explorerReview extends Controller {
    public function __construct() {
        parent::__construct();
        $this->model = Model('Source');
    }

    public function setStatus() {
        $data = Input::getArray(array(
            'path'   => array('check' => 'require'),
            'status' => array('check' => 'require'),
        ));
        $info = IO::info($data['path']);
        if (!$info || !$info['sourceID']) {
            show_json(LNG('explorer.error'), false);
        }
        $this->model->metaSet($info['sourceID'], 'reviewStatus', $data['status']);
        show_json(LNG('explorer.success'), true);
    }
}
